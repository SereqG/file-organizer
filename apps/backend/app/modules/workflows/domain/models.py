from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4
from typing import Any, Literal, Optional


@dataclass
class WorkflowEdge:
    id: str
    source: str
    target: str


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


@dataclass
class ExecutionContext:
    execution_id: UUID = field(default_factory=uuid4)
    started_at: datetime = field(default_factory=datetime.utcnow)
    root_path: str = ""
    items: list[WorkflowItem] = field(default_factory=list)
    variables: dict[str, Any] = field(default_factory=dict)
    logs: list[Any] = field(default_factory=list)
    outputs: dict[str, Any] = field(default_factory=dict)
