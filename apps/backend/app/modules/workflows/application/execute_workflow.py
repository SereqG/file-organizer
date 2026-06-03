from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable, Optional

from app.modules.workflows.application.conditions.partition import (
    MissingFieldError,
    partition_if,
    partition_switch,
)
from app.modules.workflows.application.nodes.copy import execute_copy_file, execute_copy_folder
from app.modules.workflows.application.nodes.create_folder import execute_create_folder
from app.modules.workflows.application.nodes.delete_file import execute_delete_file
from app.modules.workflows.application.nodes.delete_folder import execute_delete_folder
from app.modules.workflows.application.nodes.move import execute_move_file, execute_move_folder
from app.modules.workflows.application.nodes.rename_file import execute_rename_file
from app.modules.workflows.application.nodes.rename_folder import execute_rename_folder
from app.modules.workflows.application.nodes.transfer_helpers import apply_config_remaps_to_nodes
from app.modules.workflows.domain.models import (
    ExecutionContext,
    ExecutionWarning,
    Workflow,
    WorkflowNode,
)

IF_NODE_TYPE = "if"
SWITCH_NODE_TYPE = "switch"
TRIGGER_PREFIX = "trigger-"

# Sentinel error returned when a paused run is cancelled, so the runner can map it to a distinct
# "cancelled" status (vs. a genuine failure). Raised from ``context.request_decision``.
CANCELLED_ERROR = "__workflow_cancelled__"


class WorkflowCancelled(Exception):
    """Raised by ``context.request_decision`` when the user cancels a suspended run."""


@dataclass
class NodeExecutionResult:
    error: Optional[str] = None
    undo: Optional[Callable[[], None]] = None
    commit: Optional[Callable[[], None]] = None
    # Item-id deltas the node applied to ``context.items``. Derived by the engine by diffing the
    # item set around the handler call, so handlers stay the single owner of the mutation and need
    # no extra bookkeeping. ``produced_ids`` always join downstream scope; ``removed_ids`` drop out.
    produced_ids: set[str] = field(default_factory=set)
    removed_ids: set[str] = field(default_factory=set)


@dataclass
class FailedNode:
    id: str
    error: str


@dataclass
class WorkflowExecutionResult:
    error: Optional[str] = None
    failed_nodes: list[FailedNode] = field(default_factory=list)
    executed_node_ids: list[str] = field(default_factory=list)
    # Non-fatal warnings accumulated during the run (collected even when a later node aborts).
    warnings: list[ExecutionWarning] = field(default_factory=list)


_NODE_HANDLERS = {
    "createFolder": execute_create_folder,
    "deleteFolder": execute_delete_folder,
    "renameFolder": execute_rename_folder,
    "deleteFile": execute_delete_file,
    "renameFile": execute_rename_file,
    "moveFile": execute_move_file,
    "moveFolder": execute_move_folder,
    "copyFile": execute_copy_file,
    "copyFolder": execute_copy_folder,
}


def _dispatch(node: WorkflowNode, context: ExecutionContext, scope: set[str]) -> NodeExecutionResult:
    handler = _NODE_HANDLERS.get(node.type)
    if handler is None:
        return NodeExecutionResult(error=f"Unknown node type: {node.type}")
    before = {item.id for item in context.items}
    error, undo, commit = handler(node, context, scope)
    after = {item.id for item in context.items}
    return NodeExecutionResult(
        error=error,
        undo=undo,
        commit=commit,
        produced_ids=after - before,
        removed_ids=before - after,
    )


def _reconcile_lookup(
    item_by_id: dict,
    context: ExecutionContext,
    produced_ids: set[str],
    removed_ids: set[str],
) -> None:
    """Keep ``item_by_id`` in step with ``context.items`` after a node runs. Renames/moves mutate
    item objects in place (same id), so only additions and removals need patching."""
    for removed_id in removed_ids:
        item_by_id.pop(removed_id, None)
    if produced_ids:
        for item in context.items:
            if item.id in produced_ids:
                item_by_id[item.id] = item


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
    remaps_applied = 0  # how many of context.config_remaps have been pushed to downstream configs

    def unwind() -> None:
        for undo in reversed(undo_stack):
            undo()

    for index, node_id in enumerate(order):
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
                if not context.dry_run:
                    unwind()
                return WorkflowExecutionResult(
                    error=error,
                    failed_nodes=[FailedNode(id=node_id, error=error)],
                    executed_node_ids=executed,
                    warnings=list(context.warnings),
                )
            continue

        try:
            result = _dispatch(node, context, scope)
        except WorkflowCancelled:
            # The user cancelled while this node was suspended awaiting a decision. Roll back
            # everything done so far and report a distinct cancelled status to the runner.
            if not context.dry_run:
                unwind()
            return WorkflowExecutionResult(
                error=CANCELLED_ERROR,
                executed_node_ids=executed,
                warnings=list(context.warnings),
            )
        except Exception as exc:  # noqa: BLE001 - any unexpected node error must still roll back.
            if not context.dry_run:
                unwind()
            return WorkflowExecutionResult(
                error=f"Unexpected error in node {node_id}: {exc}",
                failed_nodes=[FailedNode(id=node_id, error=str(exc))],
                executed_node_ids=executed,
                warnings=list(context.warnings),
            )
        if result.error:
            if not context.dry_run:
                unwind()
            return WorkflowExecutionResult(
                error=result.error,
                failed_nodes=[FailedNode(id=node_id, error=result.error)],
                executed_node_ids=executed,
                warnings=list(context.warnings),
            )

        if not context.dry_run:
            if result.undo:
                undo_stack.append(result.undo)
            if result.commit:
                commit_stack.append(result.commit)

        _reconcile_lookup(item_by_id, context, result.produced_ids, result.removed_ids)

        # Items the node produced always flow downstream; items it removed drop out so deleted
        # items don't haunt later filters.
        outgoing_scope = (scope - result.removed_ids) | result.produced_ids
        for target, _ in out_edges.get(node_id, []):
            incoming[target] |= outgoing_scope

        # A Move rewrites paths; push any new remaps onto the configs of nodes that haven't run yet
        # so they target the relocated paths (applied in dry-run too, for a faithful preview).
        if len(context.config_remaps) > remaps_applied:
            new_remaps = context.config_remaps[remaps_applied:]
            downstream = [node_map[n] for n in order[index + 1:]]
            apply_config_remaps_to_nodes(downstream, new_remaps)
            remaps_applied = len(context.config_remaps)

    if not context.dry_run:
        for commit in commit_stack:
            commit()

    return WorkflowExecutionResult(executed_node_ids=executed, warnings=list(context.warnings))


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
