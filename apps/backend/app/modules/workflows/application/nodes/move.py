"""Move nodes — relocate the in-scope items (of the node's type) into one target directory.

``moveFile`` and ``moveFolder`` are thin wrappers over :func:`execute_move`, differing only in the
item type they act on. The heavy lifting (scope-faithful roots, classification, collision handling,
path rewriting, staging) lives in :mod:`transfer_helpers`.
"""

import shutil
import tempfile
from pathlib import Path
from typing import Callable, Optional

from app.modules.workflows.application.nodes.folder_helpers import resolve_incremental_name
from app.modules.workflows.application.nodes.file_helpers import resolve_incremental_file_name
from app.modules.workflows.application.nodes import transfer_helpers as helpers
from app.modules.workflows.domain.models import ExecutionContext, ExecutionWarning, PlannedAction, WorkflowNode
from app.modules.workflows.domain import warning_codes


def execute_move_file(node: WorkflowNode, context: ExecutionContext, scope: set[str]):
    return execute_move(node, context, scope, "file")


def execute_move_folder(node: WorkflowNode, context: ExecutionContext, scope: set[str]):
    return execute_move(node, context, scope, "directory")


def execute_move(
    node: WorkflowNode, context: ExecutionContext, scope: set[str], item_type: str
) -> tuple[Optional[str], Optional[Callable], Optional[Callable]]:
    config = node.config
    target: str = config.get("targetPath", "")
    if_exists: str = config.get("ifExists", "fail")
    if not target:
        return "Move node is missing a target path.", None, None

    roots = helpers.operation_roots(node, context, scope, item_type)

    # If the target itself is among the items being moved, leave it where it is (don't move it into
    # itself) but still move the others.
    if target in roots:
        context.warnings.append(
            ExecutionWarning(node.id, warning_codes.TARGET_IN_SCOPE,
                             f"Target {target} is itself in scope; left in place.", target_path=target)
        )
        roots = [root for root in roots if root != target]

    actionable = [
        root for root in roots
        if not helpers.classify_skip(node, context, root, target, check_cross_filesystem=True)
    ]

    # Each entry: (old_root, dest, staging_dir_or_None). Reversed on undo.
    moved: list[tuple[str, str, Optional[str]]] = []
    incremental = resolve_incremental_name if item_type == "directory" else resolve_incremental_file_name

    def reverse() -> None:
        for old_root, dest, staging_dir in reversed(moved):
            if not context.dry_run:
                shutil.move(dest, old_root)
            helpers.relocate_item_paths(context, dest, old_root)
            if staging_dir is not None and not context.dry_run:
                shutil.move(str(Path(staging_dir) / Path(dest).name), dest)
                shutil.rmtree(staging_dir, ignore_errors=True)

    for root in actionable:
        dest = Path(target) / Path(root).name
        claimed = {entry[1] for entry in moved}
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
                staging_dir = tempfile.mkdtemp(prefix="workflow_move_")
                shutil.move(str(dest), str(Path(staging_dir) / dest.name))

        if not context.dry_run:
            try:
                shutil.move(root, str(dest))
            except OSError:
                if staging_dir is not None:
                    shutil.move(str(Path(staging_dir) / dest.name), str(dest))
                    shutil.rmtree(staging_dir, ignore_errors=True)
                reverse()
                return f"Failed to move {root}.", None, None

        helpers.relocate_item_paths(context, root, str(dest))
        context.config_remaps.append({"oldPath": root, "newPath": str(dest)})
        context.actions.append(
            PlannedAction(node.id, "move", f"Move {root} to {dest}", item_path=root, target_path=str(dest))
        )
        moved.append((root, str(dest), staging_dir))

    if not moved:
        return None, None, None

    def undo() -> None:
        reverse()

    def commit() -> None:
        for _, _, staging_dir in moved:
            if staging_dir is not None:
                shutil.rmtree(staging_dir, ignore_errors=True)

    return None, undo, commit
