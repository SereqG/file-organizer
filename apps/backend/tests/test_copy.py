"""Stage 6 — Copy nodes (copyFile / copyFolder): fan-out, keepOriginal, produced items, rollback."""

from app.modules.workflows.application import execute_workflow as engine
from app.modules.workflows.application.execute_workflow import execute_workflow
from app.modules.workflows.application.nodes.copy import execute_copy_file, execute_copy_folder
from app.modules.workflows.application.scan_directory import scan_directory
from app.modules.workflows.domain.models import (
    ExecutionContext,
    Workflow,
    WorkflowEdge,
    WorkflowNode,
    WorkflowTrigger,
)


def node(node_id, node_type, config):
    return WorkflowNode(id=node_id, type=node_type, category="general", name=node_id, version=1, config=config)


def edge(source, target):
    return WorkflowEdge(id=f"{source}->{target}", source=source, target=target)


def workflow(nodes, edges):
    trigger = WorkflowTrigger(id="trigger-1", type="manual_trigger", category="trigger", name="t", version=1, config={})
    return Workflow(nodes=nodes, edges=edges, trigger=trigger)


def ctx_from(root, dry_run=False):
    ctx = ExecutionContext()
    ctx.root_path = str(root)
    ctx.items = scan_directory(str(root))
    ctx.dry_run = dry_run
    return ctx


def all_ids(ctx):
    return {item.id for item in ctx.items}


def subtree_ids(ctx, root):
    """Ids of a folder and its descendants — mimics an upstream filter that selected just this tree."""
    prefix = str(root)
    return {i.id for i in ctx.items if i.path == prefix or i.path.startswith(prefix + "/")}


def codes(ctx):
    return {w.code for w in ctx.warnings}


def test_copy_file_to_single_target_keeps_original(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    f = src / "a.txt"
    f.write_text("x")
    dest = tmp_path / "dest"
    dest.mkdir()
    ctx = ctx_from(tmp_path)

    error, _, _ = execute_copy_file(node("c", "copyFile", {"targetPaths": [str(dest)], "keepOriginal": True, "ifExists": "fail"}), ctx, all_ids(ctx))

    assert error is None
    assert f.exists() and (dest / "a.txt").exists()  # original kept, copy made
    assert any(i.path == str(dest / "a.txt") for i in ctx.items)  # produced item registered


def test_copy_folder_fans_out_to_multiple_targets(tmp_path):
    src = tmp_path / "src"
    (src / "sub").mkdir(parents=True)
    (src / "sub" / "b.txt").write_text("y")
    d1 = tmp_path / "d1"
    d1.mkdir()
    d2 = tmp_path / "d2"
    d2.mkdir()
    ctx = ctx_from(tmp_path)

    error, _, _ = execute_copy_folder(
        node("c", "copyFolder", {"targetPaths": [str(d1), str(d2)], "keepOriginal": True, "ifExists": "fail"}),
        ctx, subtree_ids(ctx, src),  # copy only src; targets d1/d2 are not in scope
    )

    assert error is None
    assert (d1 / "src" / "sub" / "b.txt").exists()
    assert (d2 / "src" / "sub" / "b.txt").exists()
    assert src.exists()  # original kept
    # produced items for both copied subtrees are in the tree
    assert any(i.path == str(d1 / "src" / "sub" / "b.txt") for i in ctx.items)
    assert any(i.path == str(d2 / "src" / "sub" / "b.txt") for i in ctx.items)


def test_copy_keep_original_false_removes_original(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    f = src / "a.txt"
    f.write_text("x")
    dest = tmp_path / "dest"
    dest.mkdir()
    ctx = ctx_from(tmp_path)

    error, undo, _ = execute_copy_file(node("c", "copyFile", {"targetPaths": [str(dest)], "keepOriginal": False, "ifExists": "fail"}), ctx, all_ids(ctx))

    assert error is None
    assert (dest / "a.txt").exists() and not f.exists()  # copied then original removed
    assert not any(i.path == str(f) for i in ctx.items)  # original dropped from the tree

    undo()
    assert f.exists() and not (dest / "a.txt").exists()  # copy removed, original restored


def test_copy_no_cross_filesystem_warning(tmp_path):
    # Copy never performs the cross-filesystem check, so the warning can never appear.
    src = tmp_path / "src"
    src.mkdir()
    (src / "a.txt").write_text("x")
    dest = tmp_path / "dest"
    dest.mkdir()
    ctx = ctx_from(tmp_path)

    error, _, _ = execute_copy_file(node("c", "copyFile", {"targetPaths": [str(dest)], "keepOriginal": True, "ifExists": "fail"}), ctx, all_ids(ctx))

    assert error is None
    assert (dest / "a.txt").exists()
    assert "CROSS_FILESYSTEM" not in codes(ctx)


def test_copy_collision_skip(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "a.txt").write_text("x")
    dest = tmp_path / "dest"
    dest.mkdir()
    (dest / "a.txt").write_text("existing")
    ctx = ctx_from(tmp_path)

    error, _, _ = execute_copy_file(node("c", "copyFile", {"targetPaths": [str(dest)], "keepOriginal": True, "ifExists": "skip"}), ctx, all_ids(ctx))

    assert error is None
    assert (dest / "a.txt").read_text() == "existing"
    assert "COLLISION_SKIPPED" in codes(ctx)


def test_copy_produced_items_flow_downstream(tmp_path):
    # A copy's produced items must reach a downstream node's scope (always-join rule).
    src = tmp_path / "src"
    src.mkdir()
    (src / "a.txt").write_text("x")
    dest = tmp_path / "dest"
    dest.mkdir()
    ctx = ctx_from(tmp_path)

    seen: dict[str, set] = {}

    def recorder(n, c, s):
        seen[n.id] = set(s)
        return None, None, None

    engine._NODE_HANDLERS["record"] = recorder
    try:
        cp = node("cp", "copyFile", {"targetPaths": [str(dest)], "keepOriginal": True, "ifExists": "fail"})
        rec = node("R", "record", {})
        result = execute_workflow(workflow([cp, rec], [edge("trigger-1", "cp"), edge("cp", "R")]), ctx)
    finally:
        del engine._NODE_HANDLERS["record"]

    assert result.error is None
    copied_item = next(i for i in ctx.items if i.path == str(dest / "a.txt"))
    assert copied_item.id in seen["R"]  # produced copy joined downstream scope


def test_copy_undo_on_later_failure(tmp_path, monkeypatch):
    src = tmp_path / "src"
    src.mkdir()
    (src / "a.txt").write_text("x")
    dest = tmp_path / "dest"
    dest.mkdir()
    ctx = ctx_from(tmp_path)

    monkeypatch.setitem(engine._NODE_HANDLERS, "boom", lambda n, c, s: ("boom", None, None))
    cp = node("cp", "copyFile", {"targetPaths": [str(dest)], "keepOriginal": False, "ifExists": "fail"})
    bad = node("bad", "boom", {})

    result = execute_workflow(workflow([cp, bad], [edge("trigger-1", "cp"), edge("cp", "bad")]), ctx)

    assert result.error == "boom"
    assert (src / "a.txt").exists() and not (dest / "a.txt").exists()  # copy removed, original restored
