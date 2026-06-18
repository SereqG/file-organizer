import time
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4
from typing import Any, Callable, Literal, Optional


@dataclass
class WorkflowEdge:
    id: str
    source: str
    target: str
    source_handle: Optional[str] = None


@dataclass
class WorkflowNode:
    id: str
    type: str
    category: str
    name: str
    version: int
    config: dict[str, Any]


@dataclass
class WorkflowTrigger:
    id: str
    type: str
    category: str
    name: str
    version: int
    config: dict[str, Any]


@dataclass
class Workflow:
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]
    trigger: WorkflowTrigger


@dataclass
class WorkflowItem:
    id: str
    type: Literal["file", "directory"]
    path: str
    name: str
    parent_path: str
    extension: Optional[str] = None
    size: Optional[int] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    accessed_at: Optional[datetime] = None
    mime_type: Optional[str] = None
    is_hidden: bool = False
    is_executable: bool = False
    is_readable: bool = False
    is_writable: bool = False
    is_empty: bool = False
    children_count: int = 0
    depth: int = 0


@dataclass
class ExecutionWarning:
    """A non-fatal, per-item notice raised by a node. Warnings never abort a run; they are
    collected on the context and surfaced alongside the result. See ``warning_codes`` for ``code``."""

    node_id: str
    code: str
    message: str
    item_path: Optional[str] = None
    target_path: Optional[str] = None


@dataclass
class PlannedAction:
    """One filesystem operation a node will perform. Recorded by every action node (in both real
    and dry-run mode); the dry-run preview surfaces these so the user sees what a run will do before
    any disk writes happen. ``kind`` is one of: create, delete, rename, reuse, move, copy, skip."""

    node_id: str
    kind: str
    description: str
    item_path: Optional[str] = None
    target_path: Optional[str] = None


@dataclass
class LogEntry:
    node_id: str
    node_name: str
    kind: str  # moved, copied, created, deleted, renamed, skipped, warning
    item_name: str
    message: str | None
    elapsed: float  # seconds since context.start_time


@dataclass
class ExecutionContext:
    execution_id: UUID = field(default_factory=uuid4)
    started_at: datetime = field(default_factory=datetime.utcnow)
    root_path: str = ""
    items: list[WorkflowItem] = field(default_factory=list)
    logs: list[Any] = field(default_factory=list)
    outputs: dict[str, Any] = field(default_factory=dict)
    warnings: list[ExecutionWarning] = field(default_factory=list)
    actions: list[PlannedAction] = field(default_factory=list)
    # Path remaps a Move produced ({"oldPath", "newPath"}). The engine applies new ones to
    # not-yet-executed nodes' configs in-run, and the API returns them so the canvas can update.
    config_remaps: list[dict] = field(default_factory=list)
    # When true, nodes skip the actual disk syscalls but still mutate the item tree and record
    # their PlannedAction, so the engine can produce a faithful preview without touching disk.
    dry_run: bool = False
    # Optional hook injected by the resumable runner. A node that needs the user to resolve a
    # collision calls ``request_decision(payload) -> decision``; it blocks until the user responds
    # (or raises if the run is cancelled). ``None`` for synchronous/dry runs — nodes use defaults.
    request_decision: Optional[Callable[[dict], dict]] = None
    # Hook called by the engine before each node starts. Used to stream the active node id to
    # the polling endpoint. None for dry runs — no-op when absent.
    on_node_start: Optional[Callable[[str, str], None]] = None  # (node_id, node_name)
    start_time: float = field(default_factory=time.time)
    log_entries: list[LogEntry] = field(default_factory=list)
    # Filled only when execute_workflow is called with stop_before. The tree state on entry to that
    # node (a deep copy, because nodes mutate items in place) and the item ids in scope there.
    snapshot_items: Optional[list[WorkflowItem]] = None
    snapshot_scope_ids: set[str] = field(default_factory=set)
