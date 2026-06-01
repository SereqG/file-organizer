from app.modules.workflows.domain.models import Workflow, WorkflowEdge


def trace_workflow(workflow: Workflow) -> list[str]:
    trigger_edges = [e for e in workflow.edges if e.source.startswith("trigger-")]
    return [node_id for edge in trigger_edges for node_id in _trace_route(edge.target, workflow.edges)]


def _trace_route(start: str, edges: list[WorkflowEdge]) -> list[str]:
    visited, current = [], start
    while current:
        visited.append(current)
        next_edges = [e for e in edges if e.source == current]
        current = next_edges[0].target if next_edges else None
    return visited
