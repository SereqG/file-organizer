from __future__ import annotations

from app.modules.folder_explorer.domain.models import (
    MAX_DEPTH_HARD,
    MAX_DEPTH_SOFT,
    FileTreeNode,
    SkipReason,
)


def resolve_effective_depth(extended: bool) -> int:
    return MAX_DEPTH_HARD if extended else MAX_DEPTH_SOFT


def tree_hit_soft_limit(tree: FileTreeNode) -> bool:
    if tree.skipped_reason == SkipReason.DEPTH_LIMIT:
        return True
    if tree.children:
        return any(tree_hit_soft_limit(child) for child in tree.children)
    return False
