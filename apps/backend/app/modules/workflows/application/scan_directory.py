from pathlib import Path

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

    items.append(WorkflowItem(
        id=node.id,
        type=node.type,
        path=node.path,
        name=node.name,
        parent_path=str(Path(node.path).parent),
        extension=node.extension,
        size=node.size,
    ))

    if node.children:
        for child in node.children:
            _collect_items(child, items)
