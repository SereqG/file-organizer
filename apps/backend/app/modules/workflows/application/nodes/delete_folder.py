import os
import shutil
import tempfile
from pathlib import Path
from typing import Callable, Optional

from app.modules.workflows.application.nodes.folder_helpers import find_directory_item_by_path
from app.modules.workflows.domain.models import ExecutionContext, WorkflowItem, WorkflowNode


def _is_descendant(path: str, ancestor: str) -> bool:
    return path.startswith(ancestor + os.sep)


def _resolve_targets(node: WorkflowNode, context: ExecutionContext) -> tuple[Optional[str], list[str]]:
    config = node.config

    if config.get("deleteAllEncountered"):
        encountered = [
            item.path
            for item in context.items
            if item.type == "directory" and item.path != context.root_path
        ]
        return None, encountered

    folder_paths: list[str] = config.get("folderPaths", [])
    for path in folder_paths:
        if find_directory_item_by_path(context, path) is None:
            return f"Folder {path} does not exist.", []
    return None, list(folder_paths)


def _top_level_only(paths: list[str]) -> list[str]:
    unique = sorted(set(paths))
    return [p for p in unique if not any(p != other and _is_descendant(p, other) for other in unique)]


def execute_delete_folder(node: WorkflowNode, context: ExecutionContext) -> tuple[Optional[str], Optional[Callable], Optional[Callable]]:
    error, targets = _resolve_targets(node, context)
    if error:
        return error, None, None

    targets = _top_level_only(targets)
    if not targets:
        return None, None, None

    # (target_path, staged_path, staging_dir, removed_items)
    staged: list[tuple[str, Path, str, list[WorkflowItem]]] = []

    def restore_all() -> None:
        for target, staged_path, staging_dir, removed in reversed(staged):
            shutil.move(str(staged_path), target)
            shutil.rmtree(staging_dir, ignore_errors=True)
            context.items.extend(removed)

    for target in targets:
        removed = [i for i in context.items if i.path == target or _is_descendant(i.path, target)]
        staging_dir = tempfile.mkdtemp(prefix="workflow_delete_")
        staged_path = Path(staging_dir) / Path(target).name
        try:
            shutil.move(target, str(staged_path))
        except OSError:
            shutil.rmtree(staging_dir, ignore_errors=True)
            restore_all()
            return f"Failed to delete folder {target}.", None, None
        context.items[:] = [i for i in context.items if i not in removed]
        staged.append((target, staged_path, staging_dir, removed))

    context.outputs[node.id] = {"deletedPaths": [target for target, _, _, _ in staged]}

    def undo() -> None:
        restore_all()

    def commit() -> None:
        for _, _, staging_dir, _ in staged:
            shutil.rmtree(staging_dir, ignore_errors=True)

    return None, undo, commit
