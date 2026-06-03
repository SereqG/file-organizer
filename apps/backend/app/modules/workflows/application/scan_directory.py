import mimetypes
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from app.modules.workflows.domain.models import WorkflowItem
from app.shared.traversal import FileTreeNode, MAX_DEPTH_HARD, traverse


def scan_directory(root_path: str) -> list[WorkflowItem]:
    tree = traverse(Path(root_path), MAX_DEPTH_HARD)
    items: list[WorkflowItem] = []
    _collect_items(tree, items)
    return items


def _collect_items(node: FileTreeNode, items: list[WorkflowItem]) -> None:
    if node.skipped:
        return

    items.append(_to_item(node))

    if node.children:
        for child in node.children:
            _collect_items(child, items)


def _to_item(node: FileTreeNode) -> WorkflowItem:
    is_directory = node.type == "directory"
    created_at, modified_at, accessed_at = _read_timestamps(node.path)
    mime_type, _ = mimetypes.guess_type(node.name)

    return WorkflowItem(
        id=node.id,
        type=node.type,
        path=node.path,
        name=node.name,
        parent_path=str(Path(node.path).parent),
        extension=node.extension,
        size=_recursive_size(node) if is_directory else node.size,
        created_at=created_at,
        modified_at=modified_at,
        accessed_at=accessed_at,
        mime_type=mime_type,
        is_hidden=node.name.startswith("."),
        is_executable=os.access(node.path, os.X_OK),
        is_readable=os.access(node.path, os.R_OK),
        is_writable=os.access(node.path, os.W_OK),
        is_empty=_is_empty(node) if is_directory else False,
        children_count=_visible_children_count(node),
        depth=node.level,
    )


def _read_timestamps(path: str) -> tuple[Optional[datetime], Optional[datetime], Optional[datetime]]:
    try:
        stat = os.stat(path)
    except OSError:
        return None, None, None
    return (
        datetime.fromtimestamp(stat.st_ctime),
        datetime.fromtimestamp(stat.st_mtime),
        datetime.fromtimestamp(stat.st_atime),
    )


def _visible_children(node: FileTreeNode) -> list[FileTreeNode]:
    return [child for child in (node.children or []) if not child.skipped]


def _visible_children_count(node: FileTreeNode) -> int:
    return len(_visible_children(node))


def _recursive_size(node: FileTreeNode) -> int:
    total = node.size or 0
    for child in _visible_children(node):
        total += _recursive_size(child) if child.type == "directory" else (child.size or 0)
    return total


def _is_empty(node: FileTreeNode) -> bool:
    children = _visible_children(node)
    if not children:
        return True
    return all(child.type == "directory" and _is_empty(child) for child in children)
