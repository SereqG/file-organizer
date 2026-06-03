"""Stage 3 — dry-run simulates the workflow without touching disk.

Each test runs a real node with ``context.dry_run = True`` and asserts the filesystem is untouched
while the item tree and the recorded PlannedActions reflect what a real run would do.
"""

from app.modules.workflows.application.execute_workflow import execute_workflow
from app.modules.workflows.domain.models import (
    ExecutionContext,
    Workflow,
    WorkflowEdge,
    WorkflowItem,
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


def dir_item(item_id, path):
    return WorkflowItem(id=item_id, type="directory", path=str(path), name=path.name, parent_path=str(path.parent))


def file_item(item_id, path):
    return WorkflowItem(id=item_id, type="file", path=str(path), name=path.name, parent_path=str(path.parent), extension=path.suffix or None)


def dry_context(*items):
    ctx = ExecutionContext()
    ctx.items = list(items)
    ctx.dry_run = True
    return ctx


def test_dry_run_create_does_not_touch_disk(tmp_path):
    parent = dir_item("p", tmp_path)
    ctx = dry_context(parent)
    n = node("cf", "createFolder", {"folderName": "new", "parentFolderPath": str(tmp_path), "ifExists": "fail"})

    result = execute_workflow(workflow([n], [edge("trigger-1", "cf")]), ctx)

    assert result.error is None
    assert not (tmp_path / "new").exists()  # no disk write
    assert any(a.kind == "create" for a in ctx.actions)
    assert any(i.path == str(tmp_path / "new") for i in ctx.items)  # predicted item joins the tree


def test_dry_run_delete_keeps_disk(tmp_path):
    folder = tmp_path / "keep"
    folder.mkdir()
    item = dir_item("k", folder)
    ctx = dry_context(item)
    n = node("df", "deleteFolder", {"deleteAllEncountered": False, "folderPaths": [str(folder)]})

    result = execute_workflow(workflow([n], [edge("trigger-1", "df")]), ctx)

    assert result.error is None
    assert folder.exists()  # not actually deleted
    assert item not in ctx.items  # predicted removal
    assert [a.kind for a in ctx.actions] == ["delete"]


def test_dry_run_rename_keeps_disk(tmp_path):
    source = tmp_path / "a.txt"
    source.write_text("x")
    item = file_item("a", source)
    ctx = dry_context(item)
    n = node("rf", "renameFile", {"filePath": str(source), "newName": "b", "ifExists": "fail"})

    result = execute_workflow(workflow([n], [edge("trigger-1", "rf")]), ctx)

    assert result.error is None
    assert source.exists() and not (tmp_path / "b.txt").exists()  # disk unchanged
    assert item.path == str(tmp_path / "b.txt")  # predicted rename in the tree
    assert ctx.actions[0].kind == "rename"


def test_dry_run_predicts_a_failure_without_raising(tmp_path):
    (tmp_path / "new").mkdir()  # the folder the node would try to create already exists
    parent = dir_item("p", tmp_path)
    ctx = dry_context(parent)
    n = node("cf", "createFolder", {"folderName": "new", "parentFolderPath": str(tmp_path), "ifExists": "fail"})

    result = execute_workflow(workflow([n], [edge("trigger-1", "cf")]), ctx)

    assert result.error is not None and "already exists" in result.error
    assert [n.id for n in result.failed_nodes] == ["cf"]


def test_dry_run_chains_predicted_tree_across_nodes(tmp_path):
    # Create a folder, then delete-all-encountered: the just-produced folder is in scope and gets a
    # predicted delete. Proves the working tree carries produced items across nodes in dry-run.
    parent = dir_item("p", tmp_path)
    ctx = dry_context(parent)
    create = node("cf", "createFolder", {"folderName": "tmp", "parentFolderPath": str(tmp_path), "ifExists": "fail"})
    delete = node("df", "deleteFolder", {"deleteAllEncountered": True, "folderPaths": []})

    result = execute_workflow(
        workflow([create, delete], [edge("trigger-1", "cf"), edge("cf", "df")]),
        ctx,
    )

    assert result.error is None
    assert not (tmp_path / "tmp").exists()  # nothing created or deleted on disk
    kinds = [a.kind for a in ctx.actions]
    assert kinds == ["create", "delete"]
