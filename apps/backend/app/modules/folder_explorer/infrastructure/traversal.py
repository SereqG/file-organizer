from __future__ import annotations

import uuid
from pathlib import Path

from app.modules.folder_explorer.domain.models import (
    ARCHIVE_EXTENSIONS,
    IGNORED_DIRS,
    MAX_FILES_PER_DIRECTORY,
    MAX_TOTAL_FILES,
    FileTreeNode,
    SkipReason,
)


def traverse(root: Path, max_depth: int) -> FileTreeNode:
    counter = [0]
    return _traverse_node(root, level=0, max_depth=max_depth, counter=counter)


def _traverse_node(path: Path, level: int, max_depth: int, counter: list[int]) -> FileTreeNode:
    node_id = str(uuid.uuid4())

    if path.is_symlink():
        return _skipped_node(node_id, path, level, SkipReason.SYMBOLIC_LINK)

    if path.is_dir():
        return _traverse_directory(path, node_id, level, max_depth, counter)

    return _traverse_file(path, node_id, level)


def _traverse_directory(
    path: Path,
    node_id: str,
    level: int,
    max_depth: int,
    counter: list[int],
) -> FileTreeNode:
    if path.name in IGNORED_DIRS:
        return _skipped_node(node_id, path, level, SkipReason.IGNORED_DIRECTORY)

    if level >= max_depth:
        return _skipped_node(node_id, path, level, SkipReason.DEPTH_LIMIT)

    try:
        raw_entries = list(path.iterdir())
    except PermissionError:
        return _skipped_node(node_id, path, level, SkipReason.PERMISSION_DENIED)
    except OSError:
        return _skipped_node(node_id, path, level, SkipReason.IO_ERROR)

    entries = raw_entries[:MAX_FILES_PER_DIRECTORY]
    children: list[FileTreeNode] = []

    for entry in entries:
        if counter[0] >= MAX_TOTAL_FILES:
            break
        child = _traverse_node(entry, level + 1, max_depth, counter)
        children.append(child)
        counter[0] += 1

    return FileTreeNode(
        id=node_id,
        name=path.name,
        path=str(path),
        type="directory",
        level=level,
        children=children,
    )


def _traverse_file(path: Path, node_id: str, level: int) -> FileTreeNode:
    extension = path.suffix.lower() or None

    if extension in ARCHIVE_EXTENSIONS:
        return FileTreeNode(
            id=node_id,
            name=path.name,
            path=str(path),
            type="file",
            level=level,
            extension=extension,
            skipped=True,
            skipped_reason=SkipReason.ARCHIVE_NOT_SUPPORTED,
        )

    size: int | None = None
    try:
        size = path.lstat().st_size
    except OSError:
        pass

    return FileTreeNode(
        id=node_id,
        name=path.name,
        path=str(path),
        type="file",
        level=level,
        extension=extension,
        size=size,
    )


def _skipped_node(node_id: str, path: Path, level: int, reason: SkipReason) -> FileTreeNode:
    return FileTreeNode(
        id=node_id,
        name=path.name,
        path=str(path),
        type="directory" if reason in (SkipReason.DEPTH_LIMIT, SkipReason.IGNORED_DIRECTORY, SkipReason.PERMISSION_DENIED, SkipReason.IO_ERROR) else "file",
        level=level,
        skipped=True,
        skipped_reason=reason,
    )
