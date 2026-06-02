from pathlib import Path
from typing import Optional

from app.modules.workflows.domain.models import ExecutionContext, WorkflowItem


def find_file_item_by_path(context: ExecutionContext, path: str) -> Optional[WorkflowItem]:
    return next(
        (item for item in context.items if item.path == path and item.type == "file"),
        None,
    )


def resolve_incremental_file_name(base_path: Path) -> Path:
    # Insert the counter before the extension so "report.pdf" becomes "report_1.pdf".
    counter = 1
    while True:
        candidate = base_path.with_name(f"{base_path.stem}_{counter}{base_path.suffix}")
        if not candidate.exists():
            return candidate
        counter += 1
