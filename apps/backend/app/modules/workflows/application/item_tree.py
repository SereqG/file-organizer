"""Serialize a flat ``WorkflowItem`` list (the engine's virtual tree) into a nested
``FileTreeNode``-shaped dict — the shape every frontend path picker consumes.

Linking is purely by ``path``/``parent_path``, so predicted-created folders (fresh uuid id, real-ish
path) and moved items (re-parented paths) slot in correctly without any special handling.
"""

from typing import Optional

from app.modules.workflows.domain.models import WorkflowItem


def _to_node(item: WorkflowItem, children_by_parent: dict[str, list[WorkflowItem]]) -> dict:
    children_items = children_by_parent.get(item.path, [])
    # Directories first, then by name ascending — matches the picker's ordering expectations.
    children_items.sort(key=lambda child: (child.type != "directory", child.name))
    return {
        "id": item.id,
        "name": item.name,
        "path": item.path,
        "type": item.type,
        "level": item.depth,
        "extension": item.extension,
        "size": item.size,
        "skipped": False,
        "skipped_reason": None,
        "children": [_to_node(child, children_by_parent) for child in children_items],
    }


def items_to_tree(items: list[WorkflowItem], root_path: str) -> Optional[dict]:
    """Build a nested FileTreeNode-shaped dict from a flat WorkflowItem list.
    Returns None if no root item can be resolved (empty/invalid tree)."""
    if not items:
        return None

    root = next((item for item in items if item.path == root_path), None)
    if root is None:
        root = min(items, key=lambda item: item.depth)

    children_by_parent: dict[str, list[WorkflowItem]] = {}
    for item in items:
        if item is root:
            continue
        children_by_parent.setdefault(item.parent_path, []).append(item)

    return _to_node(root, children_by_parent)
