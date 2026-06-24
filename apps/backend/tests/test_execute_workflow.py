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


@pytest.fixture
def recorder(monkeypatch):
    """Register a side-effect-free node type that records the scope it receives."""
    calls: dict[str, list[set]] = defaultdict(list)

    def handler(node, context, scope):
        calls[node.id].append(set(scope))
        return None, None, None

    monkeypatch.setitem(module._NODE_HANDLERS, "record", handler)
    return calls


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


def test_if_routes_items_to_true_and_false_branches(recorder):
    ctx = context_with(item("a", "a.txt", ".txt"), item("b", "b.log", ".log"))
    wf = workflow(
        [node("if1", "if", if_config()), node("T", "record"), node("F", "record")],
        [edge("trigger-1", "if1"), edge("if1", "T", "true"), edge("if1", "F", "false")],
    )

    result = execute_workflow(wf, ctx)

    assert result.error is None
    assert recorder["T"] == [{"a"}]
    assert recorder["F"] == [{"b"}]


def test_empty_branch_subtree_is_skipped(recorder):
    # Every item matches, so the false branch is empty and F must not run.
    ctx = context_with(item("a", "a.txt", ".txt"), item("b", "c.txt", ".txt"))
    wf = workflow(
        [node("if1", "if", if_config()), node("T", "record"), node("F", "record")],
        [edge("trigger-1", "if1"), edge("if1", "T", "true"), edge("if1", "F", "false")],
    )

    execute_workflow(wf, ctx)

    assert recorder["T"] == [{"a", "b"}]
    assert "F" not in recorder


def test_branches_merge_with_union_scope_and_run_once(recorder):
    ctx = context_with(item("a", "a.txt", ".txt"), item("b", "b.log", ".log"))
    wf = workflow(
        [node("if1", "if", if_config()), node("M", "record")],
        [
            edge("trigger-1", "if1"),
            edge("if1", "M", "true"),
            edge("if1", "M", "false"),
        ],
    )

    execute_workflow(wf, ctx)

    assert recorder["M"] == [{"a", "b"}]


def test_unconnected_handle_drops_its_items(recorder):
    # Only the true handle is wired; false-branch items go nowhere.
    ctx = context_with(item("a", "a.txt", ".txt"), item("b", "b.log", ".log"))
    wf = workflow(
        [node("if1", "if", if_config()), node("T", "record")],
        [edge("trigger-1", "if1"), edge("if1", "T", "true")],
    )

    result = execute_workflow(wf, ctx)

    assert result.error is None
    assert recorder["T"] == [{"a"}]


def test_linear_node_receives_full_scope(recorder):
    ctx = context_with(item("a", "a.txt", ".txt"), item("b", "b.log", ".log"))
    wf = workflow(
        [node("A", "record")],
        [edge("trigger-1", "A")],
    )

    execute_workflow(wf, ctx)

    assert recorder["A"] == [{"a", "b"}]


def test_edge_to_missing_node_is_rejected(recorder):
    # Edge targets an if-node that is absent from the nodes list (and a second edge sourced from it).
    ctx = context_with(item("a", "a.txt", ".txt"))
    wf = workflow(
        [node("deleteFolder-1", "record")],
        [edge("trigger-1", "if-1"), edge("if-1", "deleteFolder-1", "true")],
    )

    result = execute_workflow(wf, ctx)

    assert result.error is not None
    assert "if-1" in result.error
    assert "deleteFolder-1" not in recorder


def switch_config(*cases):
    """cases: (case_id, field, operator, value) tuples -> switch node config."""
    return {
        "cases": [
            {"id": cid, "conditions": {"operator": "AND", "children": [{"field": f, "operator": op, "value": v}]}}
            for cid, f, op, v in cases
        ]
    }


def test_switch_fans_out_and_routes_unmatched_to_default(recorder):
    ctx = context_with(
        item("a", "a.txt", ".txt"),
        item("b", "b.log", ".log"),
        item("c", "c.pdf", ".pdf"),
    )
    config = switch_config(("c1", "extension", "equals", ".txt"), ("c2", "name", "contains", "."))
    wf = workflow(
        [node("sw", "switch", config), node("A", "record"), node("B", "record"), node("D", "record")],
        [
            edge("trigger-1", "sw"),
            edge("sw", "A", "c1"),       # extension == .txt -> only "a"
            edge("sw", "B", "c2"),       # name contains "." -> all three
            edge("sw", "D", "default"),  # matched no case -> none (every name has a ".")
        ],
    )

    result = execute_workflow(wf, ctx)

    assert result.error is None
    assert recorder["A"] == [{"a"}]
    assert recorder["B"] == [{"a", "b", "c"}]
    assert "D" not in recorder  # default branch empty -> subtree skipped


def test_switch_unconnected_handle_drops_its_items(recorder):
    ctx = context_with(item("a", "a.txt", ".txt"), item("b", "b.log", ".log"))
    config = switch_config(("c1", "extension", "equals", ".txt"), ("c2", "extension", "equals", ".log"))
    wf = workflow(
        [node("sw", "switch", config), node("A", "record")],
        [edge("trigger-1", "sw"), edge("sw", "A", "c1")],  # c2 + default unwired
    )

    result = execute_workflow(wf, ctx)

    assert result.error is None
    assert recorder["A"] == [{"a"}]


def test_cycle_is_rejected(recorder):
    ctx = context_with(item("a", "a.txt", ".txt"))
    wf = workflow(
        [node("A", "record"), node("B", "record")],
        [edge("trigger-1", "A"), edge("A", "B"), edge("B", "A")],
    )

    result = execute_workflow(wf, ctx)

    assert result.error is not None
    assert "cycle" in result.error.lower()
