import shutil
import tempfile
import time
from pathlib import Path
from typing import Callable, Optional

from app.modules.workflows.application.nodes.file_helpers import find_file_item_by_path
from app.modules.workflows.domain.models import ExecutionContext, LogEntry, PlannedAction, WorkflowItem, WorkflowNode


def _resolve_targets(node: WorkflowNode, context: ExecutionContext, scope: set[str]) -> tuple[Optional[str], list[str]]:
    config = node.config

    if config.get("deleteAllEncountered"):
        # "Encountered" = the files flowing into this node. With no upstream If node the scope is
        # every scanned item, so this stays equivalent to deleting all files.
        encountered = [
            item.path
            for item in context.items
            if item.id in scope and item.type == "file"
        ]
        return None, encountered

    file_paths: list[str] = config.get("filePaths", [])
    for path in file_paths:
        if find_file_item_by_path(context, path) is None:
            return f"File {path} does not exist.", []
    return None, file_paths


def execute_delete_file(node: WorkflowNode, context: ExecutionContext, scope: set[str]) -> tuple[Optional[str], Optional[Callable], Optional[Callable]]:
    error, targets = _resolve_targets(node, context, scope)
    if error:
        return error, None, None

    targets = sorted(set(targets))
    if not targets:
        return None, None, None

    # (target_path, staged_path, staging_dir, removed_item)
    staged: list[tuple[str, Path, str, WorkflowItem]] = []

    def restore_all() -> None:
        for target, staged_path, staging_dir, removed in reversed(staged):
            shutil.move(str(staged_path), target)
            shutil.rmtree(staging_dir, ignore_errors=True)
            if removed is not None:
                context.items.append(removed)

    for target in targets:
        removed = next((i for i in context.items if i.path == target), None)
        if not context.dry_run:
            staging_dir = tempfile.mkdtemp(prefix="workflow_delete_file_")
            staged_path = Path(staging_dir) / Path(target).name
            try:
                shutil.move(target, str(staged_path))
            except OSError:
                shutil.rmtree(staging_dir, ignore_errors=True)
                restore_all()
                return f"Failed to delete file {target}.", None, None
            staged.append((target, staged_path, staging_dir, removed))
        if removed is not None:
            context.items[:] = [i for i in context.items if i is not removed]
        context.actions.append(PlannedAction(node.id, "delete", f"Delete file {target}", target_path=target))
        context.log_entries.append(LogEntry(
            node_id=node.id, node_name=node.name, kind="deleted",
            item_name=Path(target).name, message=None,
            elapsed=time.time() - context.start_time,
        ))

    context.outputs[node.id] = {"deletedPaths": [target for target, _, _, _ in staged]}

    def undo() -> None:
        restore_all()

    def commit() -> None:
        for _, _, staging_dir, _ in staged:
            shutil.rmtree(staging_dir, ignore_errors=True)

    return None, undo, commit
