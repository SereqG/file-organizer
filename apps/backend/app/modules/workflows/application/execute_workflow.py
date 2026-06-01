from dataclasses import dataclass, field
from typing import Callable, Optional

from app.modules.workflows.application.nodes.create_folder import execute_create_folder
from app.modules.workflows.application.nodes.delete_folder import execute_delete_folder
from app.modules.workflows.application.nodes.rename_folder import execute_rename_folder
from app.modules.workflows.domain.models import ExecutionContext, Workflow, WorkflowNode


@dataclass
class NodeExecutionResult:
    error: Optional[str] = None
    undo: Optional[Callable[[], None]] = None
    commit: Optional[Callable[[], None]] = None


@dataclass
class FailedNode:
    id: str
    error: str


@dataclass
class WorkflowExecutionResult:
    error: Optional[str] = None
    failed_nodes: list[FailedNode] = field(default_factory=list)


_NODE_HANDLERS = {
    "createFolder": execute_create_folder,
    "deleteFolder": execute_delete_folder,
    "renameFolder": execute_rename_folder,
}


def _dispatch(node: WorkflowNode, context: ExecutionContext) -> NodeExecutionResult:
    handler = _NODE_HANDLERS.get(node.type)
    if handler is None:
        return NodeExecutionResult(error=f"Unknown node type: {node.type}")
    error, undo, commit = handler(node, context)
    return NodeExecutionResult(error=error, undo=undo, commit=commit)


def execute_workflow(workflow: Workflow, node_ids: list[str], context: ExecutionContext) -> WorkflowExecutionResult:
    node_map = {n.id: n for n in workflow.nodes}
    undo_stack: list[Callable] = []
    commit_stack: list[Callable] = []

    for node_id in node_ids:
        node = node_map.get(node_id)
        if node is None:
            error = f"Node {node_id} not found in workflow definition."
            for undo in reversed(undo_stack):
                undo()
            return WorkflowExecutionResult(error=error, failed_nodes=[FailedNode(id=node_id, error=error)])

        result = _dispatch(node, context)

        if result.error:
            for undo in reversed(undo_stack):
                undo()
            return WorkflowExecutionResult(
                error=result.error,
                failed_nodes=[FailedNode(id=node_id, error=result.error)],
            )

        if result.undo:
            undo_stack.append(result.undo)
        if result.commit:
            commit_stack.append(result.commit)

    for commit in commit_stack:
        commit()

    return WorkflowExecutionResult()
