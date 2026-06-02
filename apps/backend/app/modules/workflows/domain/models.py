from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4
from typing import Any, Literal, Optional


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
class ExecutionContext:
    execution_id: UUID = field(default_factory=uuid4)
    started_at: datetime = field(default_factory=datetime.utcnow)
    root_path: str = ""
    items: list[WorkflowItem] = field(default_factory=list)
    variables: dict[str, Any] = field(default_factory=dict)
    logs: list[Any] = field(default_factory=list)
    outputs: dict[str, Any] = field(default_factory=dict)
