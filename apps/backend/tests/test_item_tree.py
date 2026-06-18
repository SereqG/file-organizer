"""Workstream 1 — items_to_tree serializes the engine's flat virtual tree into a nested
FileTreeNode-shaped dict, including predicted-created folders and moved items."""

from app.modules.workflows.application.item_tree import items_to_tree
from app.modules.workflows.domain.models import WorkflowItem


def dir_item(item_id, path, parent, name, depth):
    return WorkflowItem(id=item_id, type="directory", path=path, name=name, parent_path=parent, depth=depth)


def file_item(item_id, path, parent, name, depth, ext=None):
    return WorkflowItem(id=item_id, type="file", path=path, name=name, parent_path=parent, extension=ext, depth=depth)


def test_returns_none_when_root_missing():
    # No item matches root_path and the list is empty.
    assert items_to_tree([], "/root") is None


def test_nests_children_under_parent_by_path():
    root = dir_item("r", "/root", "/", "root", 0)
    sub = dir_item("s", "/root/sub", "/root", "sub", 1)
    f = file_item("f", "/root/a.txt", "/root", "a.txt", 1, ext=".txt")

    tree = items_to_tree([f, sub, root], "/root")

    assert tree is not None
    assert tree["id"] == "r" and tree["path"] == "/root"
    # Directories first, then files, each alphabetical.
    assert [c["name"] for c in tree["children"]] == ["sub", "a.txt"]


def test_level_maps_from_depth():
    root = dir_item("r", "/root", "/", "root", 0)
    sub = dir_item("s", "/root/sub", "/root", "sub", 1)

    tree = items_to_tree([root, sub], "/root")

    assert tree["level"] == 0
    assert tree["children"][0]["level"] == 1


def test_created_folder_and_moved_item_slot_in_by_path():
    # `new` is a predicted-created folder (fresh uuid id); `b.txt` was moved out of /root into /root/new.
    root = dir_item("r", "/root", "/", "root", 0)
    created = dir_item("created-uuid", "/root/new", "/root", "new", 1)
    moved = file_item("m", "/root/new/b.txt", "/root/new", "b.txt", 2, ext=".txt")

    tree = items_to_tree([root, created, moved], "/root")

    new_node = next(c for c in tree["children"] if c["path"] == "/root/new")
    assert new_node["id"] == "created-uuid"
    assert [c["path"] for c in new_node["children"]] == ["/root/new/b.txt"]


def test_falls_back_to_shallowest_item_when_root_path_absent():
    sub = dir_item("s", "/root/sub", "/root", "sub", 1)
    f = file_item("f", "/root/sub/a.txt", "/root/sub", "a.txt", 2)

    tree = items_to_tree([f, sub], "/does/not/match")

    assert tree["id"] == "s"  # shallowest by depth
    assert [c["path"] for c in tree["children"]] == ["/root/sub/a.txt"]
