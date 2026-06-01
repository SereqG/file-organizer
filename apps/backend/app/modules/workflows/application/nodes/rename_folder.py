import os
from pathlib import Path
from typing import Callable, Optional

from app.modules.workflows.application.nodes.folder_helpers import (
    find_directory_item_by_path,
    resolve_incremental_name,
)
from app.modules.workflows.domain.models import ExecutionContext, WorkflowNode


def _rewrite_prefix(value: str, old_prefix: str, new_prefix: str) -> str:
    if value == old_prefix or value.startswith(old_prefix + os.sep):
        return new_prefix + value[len(old_prefix):]
    return value


def _rewrite_paths(context: ExecutionContext, old_prefix: str, new_prefix: str) -> None:
    for item in context.items:
        item.path = _rewrite_prefix(item.path, old_prefix, new_prefix)
        item.parent_path = _rewrite_prefix(item.parent_path, old_prefix, new_prefix)


def execute_rename_folder(node: WorkflowNode, context: ExecutionContext) -> tuple[Optional[str], Optional[Callable], Optional[Callable]]:
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

    try:
        source.rename(target)
    except OSError:
        return f"Failed to rename folder {folder_path}.", None, None

    old_prefix = str(source)
    new_prefix = str(target)
    _rewrite_paths(context, old_prefix, new_prefix)
    item.name = target.name
    context.outputs[node.id] = item

    def undo() -> None:
        target.rename(source)
        _rewrite_paths(context, new_prefix, old_prefix)
        item.name = source.name

    return None, undo, None
