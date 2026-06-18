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
    # The folder the node would create already exists in the (scanned) virtual tree. Under dry-run,
    # existence is read from the tree — never the disk — so the collision is predicted faithfully.
    parent = dir_item("p", tmp_path)
    existing = dir_item("existing", tmp_path / "new")
    ctx = dry_context(parent, existing)
    n = node("cf", "createFolder", {"folderName": "new", "parentFolderPath": str(tmp_path), "ifExists": "fail"})

    result = execute_workflow(workflow([n], [edge("trigger-1", "cf")]), ctx)

    assert result.error is not None and "already exists" in result.error
    assert [n.id for n in result.failed_nodes] == ["cf"]


def test_dry_run_chained_create_detects_virtual_collision(tmp_path):
    # Create "tmp" twice with ifExists=fail. Nothing is on disk, so the second create can only see
    # the first folder via the virtual tree — and must predict the "already exists" failure.
    parent = dir_item("p", tmp_path)
    ctx = dry_context(parent)
    create1 = node("cf1", "createFolder", {"folderName": "tmp", "parentFolderPath": str(tmp_path), "ifExists": "fail"})
    create2 = node("cf2", "createFolder", {"folderName": "tmp", "parentFolderPath": str(tmp_path), "ifExists": "fail"})

    result = execute_workflow(
        workflow([create1, create2], [edge("trigger-1", "cf1"), edge("cf1", "cf2")]),
        ctx,
    )

    assert result.error is not None and "already exists" in result.error
    assert [n.id for n in result.failed_nodes] == ["cf2"]
    assert not (tmp_path / "tmp").exists()  # purely virtual


def test_dry_run_move_into_virtually_created_folder(tmp_path):
    # Create folder "dest", then move a file into it. The destination only exists virtually; the
    # predicted tree must nest the moved file under the created folder.
    source = tmp_path / "a.txt"
    source.write_text("x")
    parent = dir_item("p", tmp_path)
    f = file_item("a", source)
    ctx = dry_context(parent, f)
    create = node("cf", "createFolder", {"folderName": "dest", "parentFolderPath": str(tmp_path), "ifExists": "fail"})
    move = node("mv", "moveFile", {"targetPath": str(tmp_path / "dest"), "ifExists": "fail"})

    result = execute_workflow(
        workflow([create, move], [edge("trigger-1", "cf"), edge("cf", "mv")]),
        ctx,
    )

    assert result.error is None
    assert not (tmp_path / "dest").exists()  # nothing on disk
    moved = next(i for i in ctx.items if i.id == "a")
    assert moved.path == str(tmp_path / "dest" / "a.txt")
    assert moved.parent_path == str(tmp_path / "dest")


def test_stop_before_snapshots_tree_on_entry_to_node(tmp_path):
    # Create a folder, then stop before the delete node: the snapshot shows the tree after the create
    # ran (folder present) but before the delete, and captures the scope arriving at the delete node.
    parent = dir_item("p", tmp_path)
    ctx = dry_context(parent)
    create = node("cf", "createFolder", {"folderName": "tmp", "parentFolderPath": str(tmp_path), "ifExists": "fail"})
    delete = node("df", "deleteFolder", {"deleteAllEncountered": True, "folderPaths": []})

    result = execute_workflow(
        workflow([create, delete], [edge("trigger-1", "cf"), edge("cf", "df")]),
        ctx,
        stop_before="df",
    )

    assert result.error is None
    assert ctx.snapshot_items is not None
    snapshot_paths = {i.path for i in ctx.snapshot_items}
    assert str(tmp_path / "tmp") in snapshot_paths  # create already applied
    assert [a.kind for a in ctx.actions] == ["create"]  # delete never dispatched
    # The created folder flows into the delete node's scope.
    created = next(i for i in ctx.snapshot_items if i.path == str(tmp_path / "tmp"))
    assert created.id in ctx.snapshot_scope_ids


def test_stop_before_deep_copies_snapshot(tmp_path):
    # The snapshot must be a deep copy: a later in-place mutation (rename) must not change it.
    source = tmp_path / "a.txt"
    source.write_text("x")
    item = file_item("a", source)
    parent = dir_item("p", tmp_path)
    ctx = dry_context(parent, item)
    rename = node("rf", "renameFile", {"filePath": str(source), "newName": "b", "ifExists": "fail"})

    execute_workflow(workflow([rename], [edge("trigger-1", "rf")]), ctx, stop_before="rf")

    snap = next(i for i in ctx.snapshot_items if i.id == "a")
    assert snap.path == str(source)  # captured before the rename mutated the live item


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
