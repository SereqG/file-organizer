from enum import Enum
from typing import Optional

from pydantic import BaseModel

from app.shared.traversal import FileTreeNode, SkipReason

MAX_DEPTH_SOFT = 3
MAX_DEPTH_HARD = 10

__all__ = ["FileTreeNode", "SkipReason", "MAX_DEPTH_SOFT", "MAX_DEPTH_HARD", "JobStatus", "ExploreJob"]


class JobStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    AWAITING_CONFIRMATION = "AWAITING_CONFIRMATION"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


class ExploreJob(BaseModel):
    job_id: str
    status: JobStatus
    tree: Optional[FileTreeNode] = None
    requires_confirmation: bool = False
    detected_depth: Optional[int] = None
    error: Optional[str] = None
