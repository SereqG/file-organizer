"""Stage 5 — Move nodes (moveFile / moveFolder) and the shared transfer core."""

from types import SimpleNamespace

from app.modules.workflows.application import execute_workflow as engine
from app.modules.workflows.application.execute_workflow import execute_workflow
from app.modules.workflows.application.nodes import transfer_helpers
from app.modules.workflows.application.nodes.move import execute_move_file, execute_move_folder
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


def id_of(ctx, path):
    return next(item.id for item in ctx.items if item.path == str(path))


def codes(ctx):
    return {w.code for w in ctx.warnings}


# --- moveFile --------------------------------------------------------------


def test_move_file_relocates_and_rewrites_item(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    f = src / "a.txt"
    f.write_text("x")
    dest = tmp_path / "dest"
    dest.mkdir()
    ctx = ctx_from(tmp_path)

    error, undo, _ = execute_move_file(node("m", "moveFile", {"targetPath": str(dest), "ifExists": "fail"}), ctx, all_ids(ctx))

    assert error is None
    assert (dest / "a.txt").exists() and not f.exists()
    moved = next(i for i in ctx.items if i.name == "a.txt")
    assert moved.path == str(dest / "a.txt") and moved.parent_path == str(dest)
    assert {"oldPath": str(f), "newPath": str(dest / "a.txt")} in ctx.config_remaps

    undo()
    assert f.exists() and not (dest / "a.txt").exists()


def test_move_file_no_op_same_location(tmp_path):
    dest = tmp_path / "dest"
    dest.mkdir()
    f = dest / "a.txt"
    f.write_text("x")
    ctx = ctx_from(tmp_path)

    error, _, _ = execute_move_file(node("m", "moveFile", {"targetPath": str(dest), "ifExists": "fail"}), ctx, all_ids(ctx))

    assert error is None
    assert f.exists()
    assert "NO_OP_SAME_LOCATION" in codes(ctx)


# --- moveFolder: scope-faithful roots --------------------------------------


def test_move_folder_as_unit(tmp_path):
    src = tmp_path / "src"
    (src / "sub").mkdir(parents=True)
    (src / "a.txt").write_text("x")
    (src / "sub" / "b.txt").write_text("y")
    dest = tmp_path / "dest"
    dest.mkdir()
    ctx = ctx_from(tmp_path)

    error, _, _ = execute_move_folder(node("m", "moveFolder", {"targetPath": str(dest), "ifExists": "fail"}), ctx, all_ids(ctx))

    assert error is None
    assert (dest / "src" / "sub" / "b.txt").exists() and not src.exists()
    assert any(i.path == str(dest / "src" / "sub" / "b.txt") for i in ctx.items)
    assert {"oldPath": str(src), "newPath": str(dest / "src")} in ctx.config_remaps
    assert "TARGET_IN_SCOPE" in codes(ctx)  # dest itself was in scope, left in place


def test_move_folder_partial_moves_in_scope_child_only(tmp_path):
    src = tmp_path / "src"
    (src / "keep").mkdir(parents=True)
    (src / "skip").mkdir()
    (src / "keep" / "k.txt").write_text("k")
    excluded = src / "skip" / "s.txt"
    excluded.write_text("s")
    dest = tmp_path / "dest"
    dest.mkdir()
    ctx = ctx_from(tmp_path)

    scope = all_ids(ctx) - {id_of(ctx, excluded)}  # upstream filtered out s.txt
    error, _, _ = execute_move_folder(node("m", "moveFolder", {"targetPath": str(dest), "ifExists": "fail"}), ctx, scope)

    assert error is None
    assert (dest / "keep" / "k.txt").exists()  # fully-in-scope child moved
    assert src.exists() and (src / "skip" / "s.txt").exists()  # partial parent untouched
    assert "PARTIAL_DIRECTORY" in codes(ctx)


def test_move_folder_parent_into_descendant_skips(tmp_path):
    src = tmp_path / "src"
    (src / "sub").mkdir(parents=True)
    (src / "sub" / "b.txt").write_text("y")
    ctx = ctx_from(tmp_path)

    # Target is a descendant of the folder being moved.
    error, _, _ = execute_move_folder(node("m", "moveFolder", {"targetPath": str(src / "sub"), "ifExists": "fail"}), ctx, all_ids(ctx))

    assert error is None
    assert src.exists()
    assert "PARENT_INTO_DESCENDANT" in codes(ctx)


# --- collisions ------------------------------------------------------------


def test_move_collision_fail_aborts_and_rolls_back(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "a.txt").write_text("x")
    dest = tmp_path / "dest"
    dest.mkdir()
    (dest / "a.txt").write_text("existing")
    ctx = ctx_from(tmp_path)

    error, undo, _ = execute_move_file(node("m", "moveFile", {"targetPath": str(dest), "ifExists": "fail"}), ctx, all_ids(ctx))

    assert error is not None and "already exists" in error
    assert undo is None
    assert (src / "a.txt").exists()  # nothing moved
    assert (dest / "a.txt").read_text() == "existing"


def test_move_collision_skip_warns(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "a.txt").write_text("x")
    dest = tmp_path / "dest"
    dest.mkdir()
    (dest / "a.txt").write_text("existing")
    ctx = ctx_from(tmp_path)

    error, _, _ = execute_move_file(node("m", "moveFile", {"targetPath": str(dest), "ifExists": "skip"}), ctx, all_ids(ctx))

    assert error is None
    assert (src / "a.txt").exists()
    assert (dest / "a.txt").read_text() == "existing"
    assert "COLLISION_SKIPPED" in codes(ctx)


def test_move_collision_rename_incrementally(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "a.txt").write_text("x")
    dest = tmp_path / "dest"
    dest.mkdir()
    (dest / "a.txt").write_text("existing")
    ctx = ctx_from(tmp_path)

    error, _, _ = execute_move_file(node("m", "moveFile", {"targetPath": str(dest), "ifExists": "rename_incrementally"}), ctx, all_ids(ctx))

    assert error is None
    assert (dest / "a_1.txt").exists() and (dest / "a.txt").read_text() == "existing"


def test_move_collision_overwrite(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "a.txt").write_text("new")
    dest = tmp_path / "dest"
    dest.mkdir()
    (dest / "a.txt").write_text("existing")
    ctx = ctx_from(tmp_path)

    error, _, commit = execute_move_file(node("m", "moveFile", {"targetPath": str(dest), "ifExists": "overwrite"}), ctx, all_ids(ctx))

    assert error is None
    assert (dest / "a.txt").read_text() == "new" and not (src / "a.txt").exists()
    commit()  # cleans staging


def test_move_same_batch_collision_uses_ifexists(tmp_path):
    # Two files with the same name from different folders moving to one target collide in-batch.
    (tmp_path / "one").mkdir()
    (tmp_path / "two").mkdir()
    (tmp_path / "one" / "a.txt").write_text("1")
    (tmp_path / "two" / "a.txt").write_text("2")
    dest = tmp_path / "dest"
    dest.mkdir()
    ctx = ctx_from(tmp_path)

    error, _, _ = execute_move_file(node("m", "moveFile", {"targetPath": str(dest), "ifExists": "rename_incrementally"}), ctx, all_ids(ctx))

    assert error is None
    assert (dest / "a.txt").exists() and (dest / "a_1.txt").exists()


def test_move_cross_filesystem_skips(tmp_path, monkeypatch):
    src = tmp_path / "src"
    src.mkdir()
    f = src / "a.txt"
    f.write_text("x")
    dest = tmp_path / "dest"
    dest.mkdir()
    ctx = ctx_from(tmp_path)  # scan with the real os.stat before patching

    real_stat = transfer_helpers.os.stat

    def fake_stat(path, *args, **kwargs):
        # Delegate to the real stat (so a missing path still raises and Path.exists stays honest
        # in the assertions below); only the device id is faked to simulate a cross-filesystem dest.
        real_stat(path, *args, **kwargs)
        return SimpleNamespace(st_dev=2 if str(path) == str(dest) else 1)

    monkeypatch.setattr(transfer_helpers.os, "stat", fake_stat)

    error, _, _ = execute_move_file(node("m", "moveFile", {"targetPath": str(dest), "ifExists": "fail"}), ctx, all_ids(ctx))

    assert error is None
    assert f.exists() and not (dest / "a.txt").exists()
    assert "CROSS_FILESYSTEM" in codes(ctx)


# --- engine integration: config remap + undo -------------------------------


def test_move_rewrites_downstream_node_config(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    (src / "f.txt").write_text("x")
    dest = tmp_path / "dest"
    dest.mkdir()
    ctx = ctx_from(tmp_path, dry_run=True)  # dry-run: rewrite happens without disk churn

    move = node("mv", "moveFolder", {"targetPath": str(dest), "ifExists": "fail"})
    delete = node("del", "deleteFolder", {"deleteAllEncountered": False, "folderPaths": [str(src)]})
    wf = workflow([move, delete], [edge("trigger-1", "mv"), edge("mv", "del")])

    result = execute_workflow(wf, ctx)

    assert result.error is None
    assert delete.config["folderPaths"] == [str(dest / "src")]  # downstream config rewritten in-run
    assert {"oldPath": str(src), "newPath": str(dest / "src")} in ctx.config_remaps


def test_move_undo_on_later_failure(tmp_path, monkeypatch):
    src = tmp_path / "src"
    src.mkdir()
    f = src / "a.txt"
    f.write_text("x")
    dest = tmp_path / "dest"
    dest.mkdir()
    ctx = ctx_from(tmp_path)

    monkeypatch.setitem(engine._NODE_HANDLERS, "boom", lambda n, c, s: ("boom", None, None))
    move = node("mv", "moveFile", {"targetPath": str(dest), "ifExists": "fail"})
    bad = node("bad", "boom", {})
    wf = workflow([move, bad], [edge("trigger-1", "mv"), edge("mv", "bad")])

    result = execute_workflow(wf, ctx)

    assert result.error == "boom"
    assert f.exists() and not (dest / "a.txt").exists()  # move rolled back
