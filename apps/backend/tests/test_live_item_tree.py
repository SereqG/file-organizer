"""Stage 1 — the runtime item tree stays live across nodes.

These tests drive the engine with side-effect-free handlers that mutate ``context.items`` the way
real nodes do (append = produce, filter = remove, in-place edit = rename). They assert that the
engine derives the produced/removed deltas, keeps ``item_by_id`` live for If/Switch routing, and
propagates the right scope downstream.
"""

from collections import defaultdict

import pytest

from app.modules.workflows.application import execute_workflow as module
from app.modules.workflows.application.execute_workflow import execute_workflow
from app.modules.workflows.domain.models import (
    ExecutionContext,
    Workflow,
    WorkflowEdge,
    WorkflowItem,
    WorkflowNode,
    WorkflowTrigger,
)


def item(item_id, name, extension):
    return WorkflowItem(id=item_id, type="file", path=f"/x/{name}", name=name, parent_path="/x", extension=extension)


def node(node_id, node_type, config=None):
    return WorkflowNode(id=node_id, type=node_type, category="general", name=node_id, version=1, config=config or {})


def edge(source, target, handle=None):
    return WorkflowEdge(id=f"{source}->{target}:{handle}", source=source, target=target, source_handle=handle)


def if_config(field="extension", operator="equals", value=".txt"):
    return {"conditions": {"operator": "AND", "children": [{"field": field, "operator": operator, "value": value}]}}


def context_with(*items):
    ctx = ExecutionContext()
    ctx.items = list(items)
    return ctx


def workflow(nodes, edges):
    trigger = WorkflowTrigger(id="trigger-1", type="manual_trigger", category="trigger", name="t", version=1, config={})
    return Workflow(nodes=nodes, edges=edges, trigger=trigger)


@pytest.fixture
def record(monkeypatch):
    calls: dict[str, list[set]] = defaultdict(list)

    def handler(node, context, scope):
        calls[node.id].append(set(scope))
        return None, None, None

    monkeypatch.setitem(module._NODE_HANDLERS, "record", handler)
    return calls


@pytest.fixture
def producer(monkeypatch):
    """Appends one new item (id ``new1``, a .txt file) to the tree, like create_folder does."""

    def handler(node, context, scope):
        context.items.append(item("new1", "new.txt", ".txt"))
        return None, None, None

    monkeypatch.setitem(module._NODE_HANDLERS, "produce", handler)


@pytest.fixture
def remover(monkeypatch):
    """Removes item ``b`` from the tree, like a delete node does."""

    def handler(node, context, scope):
        context.items[:] = [i for i in context.items if i.id != "b"]
        return None, None, None

    monkeypatch.setitem(module._NODE_HANDLERS, "remove", handler)


def test_produced_item_joins_downstream_scope(producer, record):
    ctx = context_with(item("a", "a.txt", ".txt"))
    wf = workflow(
        [node("P", "produce"), node("R", "record")],
        [edge("trigger-1", "P"), edge("P", "R")],
    )

    result = execute_workflow(wf, ctx)

    assert result.error is None
    assert record["R"] == [{"a", "new1"}]


def test_if_routes_produced_item_via_live_lookup(producer, record):
    # The produced .txt item must reach the If, be found in the live lookup, and route to true.
    ctx = context_with(item("a", "a.log", ".log"))
    wf = workflow(
        [node("P", "produce"), node("if1", "if", if_config()), node("T", "record"), node("F", "record")],
        [edge("trigger-1", "P"), edge("P", "if1"), edge("if1", "T", "true"), edge("if1", "F", "false")],
    )

    result = execute_workflow(wf, ctx)

    assert result.error is None
    assert record["T"] == [{"new1"}]
    assert record["F"] == [{"a"}]


def test_removed_item_drops_from_downstream_scope(remover, record):
    ctx = context_with(item("a", "a.txt", ".txt"), item("b", "b.txt", ".txt"))
    wf = workflow(
        [node("D", "remove"), node("R", "record")],
        [edge("trigger-1", "D"), edge("D", "R")],
    )

    result = execute_workflow(wf, ctx)

    assert result.error is None
    assert record["R"] == [{"a"}]


def test_if_after_remove_routes_against_live_tree(remover, record):
    # Both items are .txt; after b is removed the If must only see a in the live tree.
    ctx = context_with(item("a", "a.txt", ".txt"), item("b", "b.txt", ".txt"))
    wf = workflow(
        [node("D", "remove"), node("if1", "if", if_config()), node("T", "record"), node("F", "record")],
        [edge("trigger-1", "D"), edge("D", "if1"), edge("if1", "T", "true"), edge("if1", "F", "false")],
    )

    result = execute_workflow(wf, ctx)

    assert result.error is None
    assert record["T"] == [{"a"}]
    assert "F" not in record  # false branch empty -> subtree skipped


def test_rename_keeps_id_with_updated_path_downstream(monkeypatch, record):
    # An in-place rename (same id) must be visible to a downstream If that matches the new name.
    def rename(node, context, scope):
        for i in context.items:
            if i.id == "a":
                i.path = "/x/renamed.txt"
                i.name = "renamed.txt"
        return None, None, None

    monkeypatch.setitem(module._NODE_HANDLERS, "rename", rename)

    ctx = context_with(item("a", "a.txt", ".txt"))
    wf = workflow(
        [node("RN", "rename"), node("if1", "if", if_config(field="name", value="renamed.txt")), node("T", "record")],
        [edge("trigger-1", "RN"), edge("RN", "if1"), edge("if1", "T", "true")],
    )

    result = execute_workflow(wf, ctx)

    assert result.error is None
    assert record["T"] == [{"a"}]
