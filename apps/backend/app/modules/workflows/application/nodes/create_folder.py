import os
import shutil
import time
import uuid
from pathlib import Path
from typing import Callable, Optional

from app.modules.workflows.application.nodes.folder_helpers import (
    find_directory_item_by_path,
    resolve_incremental_name,
)
from app.modules.workflows.application.nodes.transfer_helpers import guard_target
from app.modules.workflows.application.nodes.tree_lookup import path_exists
from app.modules.workflows.domain.models import ExecutionContext, LogEntry, PlannedAction, WorkflowItem, WorkflowNode


def _make_workflow_item(path: Path) -> WorkflowItem:
    return WorkflowItem(
        id=str(uuid.uuid4()),
        type="directory",
        path=str(path),
        name=path.name,
        parent_path=str(path.parent),
    )


def _create_folder(path: Path, node: WorkflowNode, context: ExecutionContext) -> tuple[Optional[str], Optional[Callable], Optional[Callable]]:
    guard_error = guard_target(context, str(path))
    if guard_error:
        return guard_error, None, None
    if not context.dry_run:
        try:
            os.makedirs(path)
        except OSError:
            return f"Failed to create folder {path}.", None, None

    item = _make_workflow_item(path)
    context.items.append(item)
    context.outputs[node.id] = item
    context.actions.append(
        PlannedAction(node_id=node.id, kind="create", description=f"Create folder {path}", target_path=str(path))
    )
    context.log_entries.append(LogEntry(
        node_id=node.id, node_name=node.name, kind="created",
        item_name=path.name, message=None,
        elapsed=time.time() - context.start_time,
    ))

    def undo():
        shutil.rmtree(path, ignore_errors=True)
        context.items[:] = [i for i in context.items if i.id != item.id]

    return None, undo, None


def execute_create_folder(node: WorkflowNode, context: ExecutionContext, scope: set[str]) -> tuple[Optional[str], Optional[Callable], Optional[Callable]]:
    # Create acts on an explicit configured path, so the incoming item scope does not constrain it.
    config = node.config
    folder_name: str = config.get("folderName", "")
    parent_folder_path: str = config.get("parentFolderPath", "")
    if_exists: str = config.get("ifExists", "fail")

    parent_item = find_directory_item_by_path(context, parent_folder_path)
    if parent_item is None:
        return f"Parent folder {parent_folder_path} does not exist.", None, None

    target_path = Path(parent_item.path) / folder_name

    if not path_exists(context, str(target_path)):
        return _create_folder(target_path, node, context)

    if if_exists == "reuse_existing":
        existing = next(
            (i for i in context.items if i.path == str(target_path) and i.type == "directory"),
            _make_workflow_item(target_path),
        )
        context.outputs[node.id] = existing
        context.actions.append(
            PlannedAction(node.id, "reuse", f"Reuse existing folder {target_path}", target_path=str(target_path))
        )
        return None, None, None

    if if_exists == "rename_incrementally":
        new_path = resolve_incremental_name(target_path)
        return _create_folder(new_path, node, context)

    if if_exists == "overwrite":
        guard_error = guard_target(context, str(target_path))
        if guard_error:
            return guard_error, None, None
        if not context.dry_run:
            try:
                shutil.rmtree(target_path)
            except OSError:
                return f"Failed to overwrite folder {target_path}.", None, None
        return _create_folder(target_path, node, context)

    return f"Folder {target_path} already exists.", None, None
