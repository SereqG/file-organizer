from pathlib import Path

from app.modules.workflows.application.nodes.delete_file import execute_delete_file
from app.modules.workflows.application.nodes.rename_file import execute_rename_file
from app.modules.workflows.domain.models import ExecutionContext, WorkflowItem, WorkflowNode


def file_item(path: Path) -> WorkflowItem:
    return WorkflowItem(
        id=path.name,
        type="file",
        path=str(path),
        name=path.name,
        parent_path=str(path.parent),
        extension=path.suffix or None,
    )


def node(node_id, config):
    return WorkflowNode(id=node_id, type="general", category="general", name=node_id, version=1, config=config)


def context_with(*items) -> ExecutionContext:
    ctx = ExecutionContext()
    ctx.items = list(items)
    return ctx


# --- rename_file -----------------------------------------------------------


def test_rename_file_keeps_extension(tmp_path):
    source = tmp_path / "report.pdf"
    source.write_text("x")
    item = file_item(source)
    ctx = context_with(item)
    n = node("r", {"filePath": str(source), "newName": "summary", "ifExists": "fail"})

    error, undo, _ = execute_rename_file(n, ctx, {item.id})

    assert error is None
    target = tmp_path / "summary.pdf"
    assert target.exists() and not source.exists()
    assert item.path == str(target) and item.name == "summary.pdf"

    undo()
    assert source.exists() and not target.exists()
    assert item.path == str(source) and item.name == "report.pdf"


def test_rename_file_without_extension(tmp_path):
    source = tmp_path / "notes"
    source.write_text("x")
    item = file_item(source)
    ctx = context_with(item)
    n = node("r", {"filePath": str(source), "newName": "memo", "ifExists": "fail"})

    error, _, _ = execute_rename_file(n, ctx, {item.id})

    assert error is None
    assert (tmp_path / "memo").exists()


def test_rename_file_conflict_fail(tmp_path):
    source = tmp_path / "report.pdf"
    source.write_text("x")
    (tmp_path / "summary.pdf").write_text("y")
    item = file_item(source)
    ctx = context_with(item)
    n = node("r", {"filePath": str(source), "newName": "summary", "ifExists": "fail"})

    error, undo, _ = execute_rename_file(n, ctx, {item.id})

    assert error is not None and "already exists" in error
    assert undo is None
    assert source.exists()


def test_rename_file_conflict_increments_before_extension(tmp_path):
    source = tmp_path / "report.pdf"
    source.write_text("x")
    (tmp_path / "summary.pdf").write_text("y")
    item = file_item(source)
    ctx = context_with(item)
    n = node("r", {"filePath": str(source), "newName": "summary", "ifExists": "rename_incrementally"})

    error, _, _ = execute_rename_file(n, ctx, {item.id})

    assert error is None
    assert (tmp_path / "summary_1.pdf").exists()
    assert item.name == "summary_1.pdf"


def test_rename_file_missing_target(tmp_path):
    n = node("r", {"filePath": str(tmp_path / "ghost.txt"), "newName": "x", "ifExists": "fail"})
    error, undo, _ = execute_rename_file(n, context_with(), set())
    assert error is not None and "does not exist" in error
    assert undo is None


# --- delete_file -----------------------------------------------------------


def test_delete_file_explicit_paths(tmp_path):
    a = tmp_path / "a.txt"
    b = tmp_path / "b.txt"
    a.write_text("a")
    b.write_text("b")
    item_a, item_b = file_item(a), file_item(b)
    ctx = context_with(item_a, item_b)
    n = node("d", {"deleteAllEncountered": False, "filePaths": [str(a)]})

    error, undo, commit = execute_delete_file(n, ctx, {item_a.id, item_b.id})

    assert error is None
    assert not a.exists() and b.exists()
    assert item_a not in ctx.items and item_b in ctx.items

    undo()
    assert a.exists()
    assert item_a in ctx.items

    # Re-running cleanly to exercise commit (no-op on already-restored fs is fine).
    error, _, commit = execute_delete_file(n, ctx, {item_a.id, item_b.id})
    commit()
    assert not a.exists()


def test_delete_file_all_encountered_only_files(tmp_path):
    a = tmp_path / "a.txt"
    a.write_text("a")
    sub = tmp_path / "sub"
    sub.mkdir()
    item_a = file_item(a)
    item_dir = WorkflowItem(id="sub", type="directory", path=str(sub), name="sub", parent_path=str(tmp_path))
    ctx = context_with(item_a, item_dir)
    n = node("d", {"deleteAllEncountered": True, "filePaths": []})

    error, _, _ = execute_delete_file(n, ctx, {item_a.id, item_dir.id})

    assert error is None
    assert not a.exists()
    assert sub.exists()  # directories are untouched by the file node
    assert item_a not in ctx.items and item_dir in ctx.items


def test_delete_file_missing_path(tmp_path):
    n = node("d", {"deleteAllEncountered": False, "filePaths": [str(tmp_path / "ghost.txt")]})
    error, undo, _ = execute_delete_file(n, context_with(), set())
    assert error is not None and "does not exist" in error
    assert undo is None
