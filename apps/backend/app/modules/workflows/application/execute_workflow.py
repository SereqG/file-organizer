from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable, Optional

from app.modules.workflows.application.conditions.partition import (
    MissingFieldError,
    partition_if,
    partition_switch,
)
from app.modules.workflows.application.nodes.create_folder import execute_create_folder
from app.modules.workflows.application.nodes.delete_file import execute_delete_file
from app.modules.workflows.application.nodes.delete_folder import execute_delete_folder
from app.modules.workflows.application.nodes.rename_file import execute_rename_file
from app.modules.workflows.application.nodes.rename_folder import execute_rename_folder
from app.modules.workflows.domain.models import ExecutionContext, Workflow, WorkflowNode

IF_NODE_TYPE = "if"
SWITCH_NODE_TYPE = "switch"
TRIGGER_PREFIX = "trigger-"


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
    executed_node_ids: list[str] = field(default_factory=list)


_NODE_HANDLERS = {
    "createFolder": execute_create_folder,
    "deleteFolder": execute_delete_folder,
    "renameFolder": execute_rename_folder,
    "deleteFile": execute_delete_file,
    "renameFile": execute_rename_file,
}


def _dispatch(node: WorkflowNode, context: ExecutionContext, scope: set[str]) -> NodeExecutionResult:
    handler = _NODE_HANDLERS.get(node.type)
    if handler is None:
        return NodeExecutionResult(error=f"Unknown node type: {node.type}")
    error, undo, commit = handler(node, context, scope)
    return NodeExecutionResult(error=error, undo=undo, commit=commit)


def execute_workflow(workflow: Workflow, context: ExecutionContext) -> WorkflowExecutionResult:
    edge_error = _validate_edges(workflow)
    if edge_error:
        return WorkflowExecutionResult(error=edge_error)

    node_map = {n.id: n for n in workflow.nodes}
    item_by_id = {item.id: item for item in context.items}
    out_edges = _build_adjacency(workflow, node_map)

    seed_targets = [
        e.target
        for e in workflow.edges
        if e.source.startswith(TRIGGER_PREFIX) and e.target in node_map
    ]
    reachable = _reachable_nodes(seed_targets, out_edges)

    order = _topological_order(reachable, out_edges)
    if order is None:
        return WorkflowExecutionResult(error="Workflow contains a cycle; loops are not supported yet.")

    # Scope (set of item ids) arriving at each node. Trigger seeds the entry nodes with all items.
    incoming: dict[str, set[str]] = defaultdict(set)
    all_ids = {item.id for item in context.items}
    for target in seed_targets:
        incoming[target] |= all_ids

    undo_stack: list[Callable] = []
    commit_stack: list[Callable] = []
    executed: list[str] = []

    def unwind() -> None:
        for undo in reversed(undo_stack):
            undo()

    for node_id in order:
        scope = incoming.get(node_id, set())
        if not scope:
            continue  # Reached only through empty/unconnected branches — skip the subtree.

        node = node_map[node_id]
        executed.append(node_id)

        if node.type == IF_NODE_TYPE:
            error = _route_partitioned(node, scope, item_by_id, out_edges, incoming, partition_if, "If")
        elif node.type == SWITCH_NODE_TYPE:
            error = _route_partitioned(node, scope, item_by_id, out_edges, incoming, partition_switch, "Switch")
        else:
            error = None

        if node.type in (IF_NODE_TYPE, SWITCH_NODE_TYPE):
            if error:
                unwind()
                return WorkflowExecutionResult(error=error, failed_nodes=[FailedNode(id=node_id, error=error)])
            continue

        result = _dispatch(node, context, scope)
        if result.error:
            unwind()
            return WorkflowExecutionResult(
                error=result.error,
                failed_nodes=[FailedNode(id=node_id, error=result.error)],
                executed_node_ids=executed,
            )

        if result.undo:
            undo_stack.append(result.undo)
        if result.commit:
            commit_stack.append(result.commit)

        for target, _ in out_edges.get(node_id, []):
            incoming[target] |= scope

    for commit in commit_stack:
        commit()

    return WorkflowExecutionResult(executed_node_ids=executed)


def _validate_edges(workflow: Workflow) -> Optional[str]:
    """Reject edges whose endpoints reference a node (or trigger) that is absent from the workflow."""
    known_ids = {node.id for node in workflow.nodes}
    known_ids.add(workflow.trigger.id)

    missing = {
        endpoint
        for edge in workflow.edges
        for endpoint in (edge.source, edge.target)
        if endpoint not in known_ids
    }
    if missing:
        return f"Edges reference unknown nodes: {', '.join(sorted(missing))}"
    return None


def _build_adjacency(workflow: Workflow, node_map: dict) -> dict[str, list[tuple[str, Optional[str]]]]:
    out_edges: dict[str, list[tuple[str, Optional[str]]]] = defaultdict(list)
    for edge in workflow.edges:
        if edge.source in node_map:
            out_edges[edge.source].append((edge.target, edge.source_handle))
    return out_edges


def _reachable_nodes(seeds: list[str], out_edges: dict[str, list[tuple[str, Optional[str]]]]) -> set[str]:
    reachable: set[str] = set()
    queue = list(seeds)
    while queue:
        current = queue.pop()
        if current in reachable:
            continue
        reachable.add(current)
        for target, _ in out_edges.get(current, []):
            if target not in reachable:
                queue.append(target)
    return reachable


def _topological_order(
    reachable: set[str],
    out_edges: dict[str, list[tuple[str, Optional[str]]]],
) -> Optional[list[str]]:
    """Kahn's algorithm over the reachable subgraph. Returns None when a cycle is present."""
    indegree: dict[str, int] = {node_id: 0 for node_id in reachable}
    for node_id in reachable:
        for target, _ in out_edges.get(node_id, []):
            if target in reachable:
                indegree[target] += 1

    queue = [node_id for node_id, degree in indegree.items() if degree == 0]
    order: list[str] = []
    while queue:
        current = queue.pop()
        order.append(current)
        for target, _ in out_edges.get(current, []):
            if target not in reachable:
                continue
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)

    return order if len(order) == len(reachable) else None


def _route_partitioned(
    node: WorkflowNode,
    scope: set[str],
    item_by_id: dict,
    out_edges: dict[str, list[tuple[str, Optional[str]]]],
    incoming: dict[str, set[str]],
    partition_fn: Callable[[list, dict], dict[str, list[str]]],
    label: str,
) -> Optional[str]:
    """Partition the scoped items into branches and union each branch into its target's incoming
    scope, keyed by edge ``source_handle``. Shared by the if and switch routing nodes — only the
    partition function (and error label) differs."""
    scoped_items = [item_by_id[item_id] for item_id in scope if item_id in item_by_id]
    try:
        branches = partition_fn(scoped_items, node.config)
    except MissingFieldError as exc:
        return f"{label} node {node.id}: {exc}"

    for target, handle in out_edges.get(node.id, []):
        branch_ids = branches.get(handle)
        if branch_ids:
            incoming[target] |= set(branch_ids)
    return None
