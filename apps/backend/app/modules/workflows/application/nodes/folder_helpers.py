from pathlib import Path
from typing import Optional

from app.modules.workflows.domain.models import ExecutionContext, WorkflowItem


def find_directory_item_by_path(context: ExecutionContext, path: str) -> Optional[WorkflowItem]:
    return next(
        (item for item in context.items if item.path == path and item.type == "directory"),
        None,
    )


def resolve_incremental_name(base_path: Path) -> Path:
    counter = 1
    while True:
        candidate = base_path.parent / f"{base_path.name}_{counter}"
        if not candidate.exists():
            return candidate
        counter += 1
