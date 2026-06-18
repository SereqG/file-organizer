"""Existence predicate shared by the action nodes.

In a real run, "does this path exist?" means the disk. In a dry-run there is no disk write, so it
means "is this path in the virtual tree (``context.items``)?" — the only way an upstream virtual
create/move/rename is reflected in downstream collision and existence checks.
"""

from pathlib import Path

from app.modules.workflows.domain.models import ExecutionContext


def path_exists_in_tree(context: ExecutionContext, path: str) -> bool:
    return any(item.path == path for item in context.items)


def path_exists(context: ExecutionContext, path: str) -> bool:
    """Virtual-tree existence under dry-run; real disk existence otherwise."""
    if context.dry_run:
        return path_exists_in_tree(context, path)
    return Path(path).exists()
