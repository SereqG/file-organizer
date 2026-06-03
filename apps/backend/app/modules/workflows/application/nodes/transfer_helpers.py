"""Shared core for the Move and Copy transfer nodes.

Holds the path primitives (promoted here so ``delete_folder``/``rename_folder`` and the transfer
nodes share one copy), the scope-faithful operation-root computation, the pre-flight classification
of skip cases, and collision resolution. Move and Copy are thin wrappers that differ only in the
filesystem op and the runtime-tree bookkeeping.
"""

from __future__ import annotations

import os
from pathlib import Path

from app.modules.workflows.domain.models import ExecutionContext, ExecutionWarning, WorkflowNode
from app.modules.workflows.domain import warning_codes


# --- path primitives -------------------------------------------------------


def is_descendant(path: str, ancestor: str) -> bool:
    return path.startswith(ancestor + os.sep)


def top_level_only(paths: list[str]) -> list[str]:
    """Drop any path that is nested under another path in the list (deduped, sorted)."""
    unique = sorted(set(paths))
    return [p for p in unique if not any(p != other and is_descendant(p, other) for other in unique)]


def rewrite_prefix(value: str, old_prefix: str, new_prefix: str) -> str:
    if value == old_prefix or value.startswith(old_prefix + os.sep):
        return new_prefix + value[len(old_prefix):]
    return value


def rewrite_item_paths(context: ExecutionContext, old_prefix: str, new_prefix: str) -> None:
    """Reprefix ``path``/``parent_path`` of every item under ``old_prefix`` (used by rename)."""
    for item in context.items:
        item.path = rewrite_prefix(item.path, old_prefix, new_prefix)
        item.parent_path = rewrite_prefix(item.parent_path, old_prefix, new_prefix)


def relocate_item_paths(context: ExecutionContext, old_root: str, new_root: str) -> None:
    """Like :func:`rewrite_item_paths`, but also re-parents the moved root itself (its parent and
    name change on a move, unlike a rename). Ids are preserved — the items continue downstream."""
    rewrite_item_paths(context, old_root, new_root)
    new_path = Path(new_root)
    for item in context.items:
        if item.path == new_root:
            item.parent_path = str(new_path.parent)
            item.name = new_path.name
            break


# --- node config path-remap (for rewriting other nodes after a relocation) -------------------

_SINGLE_PATH_FIELDS = {
    "createFolder": "parentFolderPath",
    "renameFolder": "folderPath",
    "renameFile": "filePath",
    "moveFile": "targetPath",
    "moveFolder": "targetPath",
}

_LIST_PATH_FIELDS = {
    "deleteFolder": "folderPaths",
    "deleteFile": "filePaths",
    "copyFile": "targetPaths",
    "copyFolder": "targetPaths",
}


def apply_config_remaps_to_nodes(nodes: list[WorkflowNode], remaps: list[dict]) -> None:
    """Rewrite path fields in the given (not-yet-executed) nodes' configs after a relocation."""
    for node in nodes:
        single = _SINGLE_PATH_FIELDS.get(node.type)
        listed = _LIST_PATH_FIELDS.get(node.type)
        for remap in remaps:
            old, new = remap["oldPath"], remap["newPath"]
            if single and isinstance(node.config.get(single), str):
                node.config[single] = rewrite_prefix(node.config[single], old, new)
            if listed and isinstance(node.config.get(listed), list):
                node.config[listed] = [rewrite_prefix(p, old, new) for p in node.config[listed]]


# --- scope-faithful operation roots ----------------------------------------


def _fully_in_scope(context: ExecutionContext, scope: set[str], dir_path: str) -> bool:
    """True when every item under ``dir_path`` present in the tree is also in scope (so the dir can
    move as a unit without dragging along anything an upstream node filtered out)."""
    return all(
        item.id in scope
        for item in context.items
        if is_descendant(item.path, dir_path)
    )


def operation_roots(node: WorkflowNode, context: ExecutionContext, scope: set[str], item_type: str) -> list[str]:
    """The paths this node should act on, by item type.

    Files: each in-scope file is its own root. Directories: scope-faithful — a directory is a unit
    root only when its whole subtree is in scope; a partially-in-scope directory is skipped (with a
    PARTIAL_DIRECTORY warning) and its in-scope child directories are considered individually.
    """
    if item_type == "file":
        return [item.path for item in context.items if item.id in scope and item.type == "file"]

    candidate_dirs = sorted(
        (
            item
            for item in context.items
            if item.id in scope and item.type == "directory" and item.path != context.root_path
        ),
        key=lambda item: item.path.count(os.sep),  # shallowest first so unit roots cover their children
    )

    roots: list[str] = []
    for directory in candidate_dirs:
        if any(directory.path == root or is_descendant(directory.path, root) for root in roots):
            continue  # already inside a chosen unit root
        if _fully_in_scope(context, scope, directory.path):
            roots.append(directory.path)
        else:
            context.warnings.append(
                ExecutionWarning(
                    node_id=node.id,
                    code=warning_codes.PARTIAL_DIRECTORY,
                    message=f"Folder {directory.path} was not moved as a unit; only its in-scope subfolders were handled.",
                    item_path=directory.path,
                )
            )
    return roots


# --- pre-flight classification ---------------------------------------------


def classify_skip(
    node: WorkflowNode,
    context: ExecutionContext,
    root: str,
    target: str,
    *,
    check_cross_filesystem: bool,
) -> bool:
    """Return True (and record a warning) when this (root → target) pair should be auto-skipped.
    Collisions are NOT handled here — they pause for a decision during execution."""
    if target == root or is_descendant(target, root):
        _warn(context, node, warning_codes.PARENT_INTO_DESCENDANT, root, target,
              f"Cannot transfer {root} into itself.")
        return True

    if str(Path(root).parent) == target:
        _warn(context, node, warning_codes.NO_OP_SAME_LOCATION, root, target,
              f"{root} already lives in the target.")
        return True

    if check_cross_filesystem:
        try:
            if os.stat(root).st_dev != os.stat(target).st_dev:
                _warn(context, node, warning_codes.CROSS_FILESYSTEM, root, target,
                      f"{root} is on a different filesystem than the target.")
                return True
        except OSError:
            pass  # cannot stat (e.g. dry-run predicted path) — let execution surface any real error

    return False


def _warn(context: ExecutionContext, node: WorkflowNode, code: str, item_path: str, target_path: str, message: str) -> None:
    context.warnings.append(
        ExecutionWarning(node_id=node.id, code=code, message=message, item_path=item_path, target_path=target_path)
    )


# --- collision decision ----------------------------------------------------

COLLISION_OPTIONS = ["overwrite", "rename_incrementally", "skip", "fail"]


def resolve_collision(context: ExecutionContext, node: WorkflowNode, root: str, dest: str, default: str) -> str:
    """Decide how to handle a destination-name collision. Suspends for a user decision when a
    ``request_decision`` hook is present (resumable run); otherwise uses the configured default."""
    if context.request_decision is not None:
        decision = context.request_decision(
            {
                "nodeId": node.id,
                "code": "COLLISION",
                "message": f"{Path(dest).name} already exists in the target.",
                "itemPath": root,
                "targetPath": dest,
                "options": COLLISION_OPTIONS,
                "default": default,
            }
        )
        return decision.get("resolution", default)
    return default
