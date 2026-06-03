"""Stage 4 — resumable execution: a run suspends for a decision, resumes, or cancels with rollback.

The engine stays synchronous and runs in an executor thread; these tests drive the event loop with
``asyncio.run`` and poll the execution store (no pytest-asyncio needed).
"""

import asyncio
import time

from app.modules.workflows.application import execute_workflow as engine_module
from app.modules.workflows.application import execution_store
from app.modules.workflows.application.execute_resumable import start_execution
from app.modules.workflows.application.execute_workflow import WorkflowExecutionResult
from app.modules.workflows.application.execution_store import (
    STATUS_CANCELLED,
    STATUS_COMPLETED,
    STATUS_AWAITING_INPUT,
)
from app.modules.workflows.domain.models import (
    ExecutionContext,
    Workflow,
    WorkflowEdge,
    WorkflowItem,
    WorkflowNode,
    WorkflowTrigger,
)


def node(node_id, node_type):
    return WorkflowNode(id=node_id, type=node_type, category="general", name=node_id, version=1, config={})


def edge(source, target):
    return WorkflowEdge(id=f"{source}->{target}", source=source, target=target)


def workflow(nodes, edges):
    trigger = WorkflowTrigger(id="trigger-1", type="manual_trigger", category="trigger", name="t", version=1, config={})
    return Workflow(nodes=nodes, edges=edges, trigger=trigger)


def item(item_id):
    return WorkflowItem(id=item_id, type="file", path=f"/x/{item_id}", name=item_id, parent_path="/x")


async def _wait_until(predicate, timeout=3.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        await asyncio.sleep(0.01)
    return False


def test_run_suspends_for_decision_then_resumes(monkeypatch):
    def decider(node, context, scope):
        if context.request_decision is None:
            return None, None, None
        decision = context.request_decision({"nodeId": node.id, "question": "pick"})
        context.outputs[node.id] = decision
        return None, None, None

    monkeypatch.setitem(engine_module._NODE_HANDLERS, "decide", decider)

    async def scenario():
        ctx = ExecutionContext()
        ctx.items = [item("a")]
        exec_id = await start_execution(workflow([node("D", "decide")], [edge("trigger-1", "D")]), ctx)
        state = execution_store.get(exec_id)

        assert await _wait_until(lambda: state.status == STATUS_AWAITING_INPUT)
        assert state.pending_decision == {"nodeId": "D", "question": "pick"}

        execution_store.resume(state, {"resolution": "overwrite"})

        assert await _wait_until(lambda: state.status == STATUS_COMPLETED)
        assert state.context.outputs["D"] == {"resolution": "overwrite"}

    asyncio.run(scenario())


def test_cancel_during_suspension_rolls_back(monkeypatch):
    # Node A produces an item with an undo; node B suspends. Cancelling B must roll back A.
    def producer_with_undo(node, context, scope):
        context.items.append(item("a1"))

        def undo():
            context.items[:] = [i for i in context.items if i.id != "a1"]

        return None, undo, None

    def decider(node, context, scope):
        context.request_decision({"nodeId": node.id})
        return None, None, None

    monkeypatch.setitem(engine_module._NODE_HANDLERS, "produce", producer_with_undo)
    monkeypatch.setitem(engine_module._NODE_HANDLERS, "decide", decider)

    async def scenario():
        ctx = ExecutionContext()
        ctx.items = [item("seed")]
        wf = workflow(
            [node("A", "produce"), node("B", "decide")],
            [edge("trigger-1", "A"), edge("A", "B")],
        )
        exec_id = await start_execution(wf, ctx)
        state = execution_store.get(exec_id)

        assert await _wait_until(lambda: state.status == STATUS_AWAITING_INPUT)
        assert any(i.id == "a1" for i in state.context.items)  # A committed before B suspended

        execution_store.cancel(state)

        assert await _wait_until(lambda: state.status == STATUS_CANCELLED)
        assert not any(i.id == "a1" for i in state.context.items)  # A's undo ran on rollback

    asyncio.run(scenario())


def test_non_pausing_run_completes(monkeypatch):
    def plain(node, context, scope):
        context.outputs[node.id] = "done"
        return None, None, None

    monkeypatch.setitem(engine_module._NODE_HANDLERS, "plain", plain)

    async def scenario():
        ctx = ExecutionContext()
        ctx.items = [item("a")]
        exec_id = await start_execution(workflow([node("P", "plain")], [edge("trigger-1", "P")]), ctx)
        state = execution_store.get(exec_id)

        assert await _wait_until(lambda: state.status == STATUS_COMPLETED)
        assert state.context.outputs["P"] == "done"

    asyncio.run(scenario())


def test_gc_drops_stale_terminal_runs():
    keep_alive = ExecutionContext()
    stale = execution_store.create("stale-run", ExecutionContext())
    execution_store.finish(stale, WorkflowExecutionResult())
    stale.updated_at = time.time() - 100_000  # well past the TTL

    # Creating a new run triggers GC of stale terminal runs.
    execution_store.create("fresh-run", keep_alive)

    assert execution_store.get("stale-run") is None
    assert execution_store.get("fresh-run") is not None
