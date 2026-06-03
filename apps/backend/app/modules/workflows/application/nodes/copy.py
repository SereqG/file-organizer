"""Copy nodes — duplicate the in-scope items (of the node's type) into one or more target dirs.

``copyFile`` and ``copyFolder`` wrap :func:`execute_copy`. They reuse the shared transfer core for
roots, classification and collisions; the differences from Move are fan-out (each root × each
target), no cross-filesystem restriction, produced-item registration, and an optional
``keepOriginal=false`` that stage-removes the originals after the copies succeed.
"""

import shutil
import tempfile
import uuid
from dataclasses import replace
from pathlib import Path
from typing import Callable, Optional

from app.modules.workflows.application.nodes.folder_helpers import resolve_incremental_name
from app.modules.workflows.application.nodes.file_helpers import resolve_incremental_file_name
from app.modules.workflows.application.nodes import transfer_helpers as helpers
from app.modules.workflows.domain.models import ExecutionContext, ExecutionWarning, PlannedAction, WorkflowItem, WorkflowNode
from app.modules.workflows.domain import warning_codes


def execute_copy_file(node: WorkflowNode, context: ExecutionContext, scope: set[str]):
    return execute_copy(node, context, scope, "file")


def execute_copy_folder(node: WorkflowNode, context: ExecutionContext, scope: set[str]):
    return execute_copy(node, context, scope, "directory")


def _clone_subtree(context: ExecutionContext, root: str, dest: str) -> list[WorkflowItem]:
    """Build WorkflowItems for a copied subtree by cloning the source items with reprefixed paths and
    fresh ids. Uniform across files/dirs and works in dry-run (no disk read); metadata mirrors the
    source, which is what downstream routing needs."""
    clones: list[WorkflowItem] = []
    for item in list(context.items):
        if item.path == root or helpers.is_descendant(item.path, root):
            clones.append(
                replace(
                    item,
                    id=str(uuid.uuid4()),
                    path=helpers.rewrite_prefix(item.path, root, dest),
                    parent_path=helpers.rewrite_prefix(item.parent_path, root, dest),
                )
            )
    dest_path = Path(dest)
    for clone in clones:
        if clone.path == dest:  # the copied root itself gets a new parent
            clone.parent_path = str(dest_path.parent)
            clone.name = dest_path.name
    return clones


def _remove_path(path: str) -> None:
    target = Path(path)
    if target.is_dir():
        shutil.rmtree(target, ignore_errors=True)
    elif target.exists():
        target.unlink()


def execute_copy(
    node: WorkflowNode, context: ExecutionContext, scope: set[str], item_type: str
) -> tuple[Optional[str], Optional[Callable], Optional[Callable]]:
    config = node.config
    targets: list[str] = config.get("targetPaths", [])
    keep_original: bool = config.get("keepOriginal", True)
    if_exists: str = config.get("ifExists", "fail")
    if not targets:
        return "Copy node is missing target paths.", None, None

    roots = helpers.operation_roots(node, context, scope, item_type)
    valid_targets = []
    for target in targets:
        if target in roots:
            context.warnings.append(
                ExecutionWarning(node.id, warning_codes.TARGET_IN_SCOPE,
                                 f"Target {target} is itself in scope; skipped as a destination.", target_path=target)
            )
        else:
            valid_targets.append(target)

    incremental = resolve_incremental_name if item_type == "directory" else resolve_incremental_file_name

    copied: list[tuple[str, list[str], Optional[str]]] = []  # (dest, produced_ids, overwrite_staging)
    staged_originals: list[tuple[str, Optional[str], list[WorkflowItem]]] = []
    claimed: set[str] = set()

    def reverse() -> None:
        for dest, produced_ids, staging_dir in reversed(copied):
            if not context.dry_run:
                _remove_path(dest)
                if staging_dir is not None:
                    shutil.move(str(Path(staging_dir) / Path(dest).name), dest)
                    shutil.rmtree(staging_dir, ignore_errors=True)
            removed = set(produced_ids)
            context.items[:] = [i for i in context.items if i.id not in removed]
        for original, staging_dir, removed_items in reversed(staged_originals):
            if not context.dry_run and staging_dir is not None:
                shutil.move(str(Path(staging_dir) / Path(original).name), original)
                shutil.rmtree(staging_dir, ignore_errors=True)
            context.items.extend(removed_items)

    for root in roots:
        root_copied = False
        for target in valid_targets:
            if helpers.classify_skip(node, context, root, target, check_cross_filesystem=False):
                continue
            dest = Path(target) / Path(root).name
            staging_dir: Optional[str] = None

            if str(dest) in claimed or dest.exists():
                resolution = helpers.resolve_collision(context, node, root, str(dest), if_exists)
                if resolution == "fail":
                    reverse()
                    return f"{dest} already exists.", None, None
                if resolution == "skip":
                    context.warnings.append(
                        ExecutionWarning(node.id, warning_codes.COLLISION_SKIPPED,
                                         f"{Path(dest).name} already exists; skipped.", item_path=root, target_path=str(dest))
                    )
                    continue
                if resolution == "rename_incrementally":
                    dest = incremental(dest)
                elif resolution == "overwrite" and not context.dry_run and dest.exists():
                    staging_dir = tempfile.mkdtemp(prefix="workflow_copy_")
                    shutil.move(str(dest), str(Path(staging_dir) / dest.name))

            if not context.dry_run:
                try:
                    if item_type == "directory":
                        shutil.copytree(root, str(dest))
                    else:
                        shutil.copy2(root, str(dest))
                except OSError:
                    if staging_dir is not None:
                        shutil.move(str(Path(staging_dir) / dest.name), str(dest))
                        shutil.rmtree(staging_dir, ignore_errors=True)
                    reverse()
                    return f"Failed to copy {root}.", None, None

            produced = _clone_subtree(context, root, str(dest))
            context.items.extend(produced)
            context.actions.append(
                PlannedAction(node.id, "copy", f"Copy {root} to {dest}", item_path=root, target_path=str(dest))
            )
            copied.append((str(dest), [p.id for p in produced], staging_dir))
            claimed.add(str(dest))
            root_copied = True

        if not keep_original and root_copied:
            removed_items = [i for i in context.items if i.path == root or helpers.is_descendant(i.path, root)]
            staging_dir = None
            if not context.dry_run:
                staging_dir = tempfile.mkdtemp(prefix="workflow_copy_orig_")
                try:
                    shutil.move(root, str(Path(staging_dir) / Path(root).name))
                except OSError:
                    shutil.rmtree(staging_dir, ignore_errors=True)
                    reverse()
                    return f"Failed to remove original {root}.", None, None
            context.items[:] = [i for i in context.items if i not in removed_items]
            context.actions.append(PlannedAction(node.id, "delete", f"Remove original {root}", target_path=root))
            staged_originals.append((root, staging_dir, removed_items))

    if not copied and not staged_originals:
        return None, None, None

    def undo() -> None:
        reverse()

    def commit() -> None:
        for _, _, staging_dir in copied:
            if staging_dir is not None:
                shutil.rmtree(staging_dir, ignore_errors=True)
        for _, staging_dir, _ in staged_originals:
            if staging_dir is not None:
                shutil.rmtree(staging_dir, ignore_errors=True)

    return None, undo, commit
