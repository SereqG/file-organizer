import time
from pathlib import Path
from typing import Callable, Optional

from app.modules.workflows.application.nodes.file_helpers import (
    find_file_item_by_path,
    resolve_incremental_file_name,
)
from app.modules.workflows.application.nodes.tree_lookup import path_exists
from app.modules.workflows.domain.models import ExecutionContext, LogEntry, PlannedAction, WorkflowNode


def execute_rename_file(node: WorkflowNode, context: ExecutionContext, scope: set[str]) -> tuple[Optional[str], Optional[Callable], Optional[Callable]]:
    # Rename targets an explicit configured file, so the incoming item scope does not constrain it.
    config = node.config
    file_path: str = config.get("filePath", "")
    new_name: str = config.get("newName", "")
    if_exists: str = config.get("ifExists", "fail")

    item = find_file_item_by_path(context, file_path)
    if item is None:
        return f"File {file_path} does not exist.", None, None

    source = Path(file_path)
    # The user edits only the stem; the original extension is preserved.
    target = source.with_name(f"{new_name}{source.suffix}")

    if path_exists(context, str(target)):
        if if_exists == "rename_incrementally":
            target = resolve_incremental_file_name(target)
        else:
            return f"A file named {target.name} already exists.", None, None

    if not context.dry_run:
        try:
            source.rename(target)
        except OSError:
            return f"Failed to rename file {file_path}.", None, None

    old_path = str(source)
    new_path = str(target)
    item.path = new_path
    item.name = target.name
    context.outputs[node.id] = item
    context.actions.append(
        PlannedAction(node.id, "rename", f"Rename file {old_path} to {target.name}", item_path=old_path, target_path=new_path)
    )
    context.log_entries.append(LogEntry(
        node_id=node.id, node_name=node.name, kind="renamed",
        item_name=source.name, message=None,
        elapsed=time.time() - context.start_time,
    ))

    def undo() -> None:
        target.rename(source)
        item.path = old_path
        item.name = source.name

    return None, undo, None
