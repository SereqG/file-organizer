from pathlib import Path
from typing import Callable, Optional

from app.modules.workflows.application.nodes.folder_helpers import (
    find_directory_item_by_path,
    resolve_incremental_name,
)
from app.modules.workflows.application.nodes.transfer_helpers import rewrite_item_paths
from app.modules.workflows.domain.models import ExecutionContext, PlannedAction, WorkflowNode


def execute_rename_folder(node: WorkflowNode, context: ExecutionContext, scope: set[str]) -> tuple[Optional[str], Optional[Callable], Optional[Callable]]:
    # Rename targets an explicit configured folder, so the incoming item scope does not constrain it.
    config = node.config
    folder_path: str = config.get("folderPath", "")
    new_name: str = config.get("newName", "")
    if_exists: str = config.get("ifExists", "fail")

    item = find_directory_item_by_path(context, folder_path)
    if item is None:
        return f"Folder {folder_path} does not exist.", None, None

    source = Path(folder_path)
    target = source.parent / new_name

    if target.exists():
        if if_exists == "rename_incrementally":
            target = resolve_incremental_name(target)
        else:
            return f"A folder named {new_name} already exists.", None, None

    if not context.dry_run:
        try:
            source.rename(target)
        except OSError:
            return f"Failed to rename folder {folder_path}.", None, None

    old_prefix = str(source)
    new_prefix = str(target)
    rewrite_item_paths(context, old_prefix, new_prefix)
    item.name = target.name
    context.outputs[node.id] = item
    context.actions.append(
        PlannedAction(node.id, "rename", f"Rename folder {old_prefix} to {target.name}", item_path=old_prefix, target_path=new_prefix)
    )

    def undo() -> None:
        target.rename(source)
        rewrite_item_paths(context, new_prefix, old_prefix)
        item.name = source.name

    return None, undo, None
