"""Stage 2 — non-fatal warnings reach the result without aborting the run."""

import pytest

from app.modules.workflows.application import execute_workflow as module
from app.modules.workflows.application.execute_workflow import execute_workflow
from app.modules.workflows.domain.models import (
    ExecutionContext,
    ExecutionWarning,
    Workflow,
    WorkflowEdge,
    WorkflowItem,
    WorkflowNode,
    WorkflowTrigger,
)


def item(item_id):
    return WorkflowItem(id=item_id, type="file", path=f"/x/{item_id}", name=item_id, parent_path="/x")


def node(node_id, node_type):
    return WorkflowNode(id=node_id, type=node_type, category="general", name=node_id, version=1, config={})


def edge(source, target):
    return WorkflowEdge(id=f"{source}->{target}", source=source, target=target)


def workflow(nodes, edges):
    trigger = WorkflowTrigger(id="trigger-1", type="manual_trigger", category="trigger", name="t", version=1, config={})
    return Workflow(nodes=nodes, edges=edges, trigger=trigger)


@pytest.fixture
def warner(monkeypatch):
    """A side-effect-free node that records a warning but otherwise succeeds."""

    def handler(node, context, scope):
        context.warnings.append(
            ExecutionWarning(node_id=node.id, code="NO_OP_SAME_LOCATION", message="nothing to do", item_path="/x/a")
        )
        return None, None, None

    monkeypatch.setitem(module._NODE_HANDLERS, "warn", handler)


def test_warning_surfaces_on_successful_run(warner):
    ctx = ExecutionContext()
    ctx.items = [item("a")]
    wf = workflow([node("W", "warn")], [edge("trigger-1", "W")])

    result = execute_workflow(wf, ctx)

    assert result.error is None
    assert result.failed_nodes == []
    assert len(result.warnings) == 1
    assert result.warnings[0].code == "NO_OP_SAME_LOCATION"
    assert result.warnings[0].node_id == "W"


def test_warning_does_not_trigger_rollback(warner, monkeypatch):
    # A node warns and succeeds; a later node fails. The run rolls back and reports the fatal error,
    # but the warning collected beforehand is still returned.
    undone = []

    def failing(node, context, scope):
        return "boom", None, None

    def succeeding_with_undo(node, context, scope):
        return None, lambda: undone.append(node.id), None

    monkeypatch.setitem(module._NODE_HANDLERS, "ok", succeeding_with_undo)
    monkeypatch.setitem(module._NODE_HANDLERS, "fail", failing)

    ctx = ExecutionContext()
    ctx.items = [item("a")]
    wf = workflow(
        [node("W", "warn"), node("OK", "ok"), node("BAD", "fail")],
        [edge("trigger-1", "W"), edge("W", "OK"), edge("OK", "BAD")],
    )

    result = execute_workflow(wf, ctx)

    assert result.error == "boom"
    assert [n.id for n in result.failed_nodes] == ["BAD"]
    assert undone == ["OK"]  # rollback ran
    assert len(result.warnings) == 1  # warning still surfaced through the rollback path
    assert result.warnings[0].code == "NO_OP_SAME_LOCATION"
