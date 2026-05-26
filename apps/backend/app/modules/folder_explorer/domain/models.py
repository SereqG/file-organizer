from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel

MAX_DEPTH_SOFT = 3
MAX_DEPTH_HARD = 10
MAX_FILES_PER_DIRECTORY = 5000
MAX_TOTAL_FILES = 20000

IGNORED_DIRS = frozenset([
    "node_modules",
    ".git",
    ".cache",
    ".next",
    "dist",
    "build",
    "vendor",
])

ARCHIVE_EXTENSIONS = frozenset([
    ".zip",
    ".tar",
    ".gz",
    ".bz2",
    ".xz",
    ".7z",
    ".rar",
    ".tgz",
])


class SkipReason(str, Enum):
    PERMISSION_DENIED = "PERMISSION_DENIED"
    SYMBOLIC_LINK = "SYMBOLIC_LINK"
    ARCHIVE_NOT_SUPPORTED = "ARCHIVE_NOT_SUPPORTED"
    DEPTH_LIMIT = "DEPTH_LIMIT"
    IGNORED_DIRECTORY = "IGNORED_DIRECTORY"
    IO_ERROR = "IO_ERROR"
    UNKNOWN = "UNKNOWN"


class JobStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    AWAITING_CONFIRMATION = "AWAITING_CONFIRMATION"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


class FileTreeNode(BaseModel):
    id: str
    name: str
    path: str
    type: Literal["file", "directory"]
    level: int
    extension: Optional[str] = None
    size: Optional[int] = None
    skipped: Optional[bool] = None
    skipped_reason: Optional[SkipReason] = None
    children: Optional[List["FileTreeNode"]] = None


class ExploreJob(BaseModel):
    job_id: str
    status: JobStatus
    tree: Optional[FileTreeNode] = None
    requires_confirmation: bool = False
    detected_depth: Optional[int] = None
    error: Optional[str] = None
