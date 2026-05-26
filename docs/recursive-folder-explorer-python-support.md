# Recursive Folder Explorer — Claude Code Support Document

## Purpose

This document defines the architecture, safety rules, and implementation guidelines for the Recursive Folder Explorer module implemented in Python.

The explorer is responsible for:
- recursively traversing validated directories,
- generating lightweight filesystem trees,
- protecting against unsafe filesystem operations,
- preparing metadata for future AI-driven workflows.

---

# Core Principles

## Security First

Traversal must NEVER:
- follow symbolic links,
- escape validated scope,
- traverse mount points recursively,
- inspect archive contents automatically,
- bypass filesystem permissions.

---

## Async Execution

Recursive traversal MUST execute asynchronously.

Do NOT:
- block HTTP requests,
- keep request lifecycle open during scanning,
- execute traversal synchronously inside controllers.

Recommended:
- background workers,
- async jobs,
- queue systems,
- detached tasks.

---

# Traversal Flow

```text
User provides path
        ↓
Validation pipeline
        ↓
Validation success response
        ↓
Background traversal starts
        ↓
Filesystem tree generated
        ↓
Results stored in memory/cache/database
        ↓
Frontend fetches results
```

---

# Depth Rules

## Soft Limit

```python
MAX_DEPTH_SOFT = 3
```

When exceeded:
- traversal pauses,
- frontend requests user confirmation,
- user may continue with increased depth.

---

## Hard Limit

```python
MAX_DEPTH_HARD = 10
```

Hard limit MUST NEVER be bypassed.

Protects against:
- infinite recursion,
- recursive mount points,
- pathological directory trees,
- resource exhaustion.

---

# Filesystem Safety

## Symbolic Links

Traversal MUST use:

```python
Path.lstat()
```

or:

```python
os.lstat()
```

instead of:

```python
Path.stat()
```

Reason:
- `stat()` follows symlinks,
- `lstat()` allows safe symlink detection.

Recommended pattern:

```python
from pathlib import Path

path = Path(current_path)

if path.is_symlink():
    return skipped_node("SYMBOLIC_LINK")
```

---

## Path Resolution Safety

Avoid blindly using:

```python
Path.resolve()
```

Reason:
- may follow symlinks,
- may escape validated scope,
- may resolve outside expected root.

Prefer:
- controlled normalization,
- absolute paths,
- explicit boundary validation.

---

# Access Validation

Do NOT manually inspect:
- ACL rules,
- chmod values,
- ownership metadata.

Instead:

```python
try:
    entries = list(path.iterdir())
except PermissionError:
    return skipped_node("PERMISSION_DENIED")
```

Filesystem should remain the source of truth for access control.

---

# Unsupported Content

## Archives

Archive files MUST be treated as regular files.

Unsupported:
- .zip
- .rar
- .7z
- .tar
- .gz

Example:

```json
{
  "type": "file",
  "extension": ".zip",
  "skipped": true,
  "skipped_reason": "ARCHIVE_NOT_SUPPORTED"
}
```

Archive extraction should only exist inside isolated sandbox environments.

---

# Ignored Directories

Default ignored directories:

```python
DEFAULT_IGNORED = [
    "node_modules",
    ".git",
    ".cache",
    ".next",
    "dist",
    "build",
    "vendor"
]
```

Future support:
- custom ignore lists,
- .gitignore integration,
- user-defined exclusions.

---

# Resource Limits

Recommended defaults:

```python
MAX_FILES_PER_DIRECTORY = 5000
MAX_TOTAL_FILES = 20000
MAX_DEPTH_HARD = 10
```

Optional future limits:
- traversal timeout,
- memory budget,
- maximum cumulative file size.

---

# JSON Tree Structure

## FileTreeNode

```python
class FileTreeNode(TypedDict):
    id: str

    name: str
    path: str

    type: Literal["file", "directory"]

    level: int

    extension: str | None
    size: int | None

    skipped: bool | None
    skipped_reason: str | None

    children: list["FileTreeNode"] | None
```

---

# Skip Reasons

```python
class SkipReason(Enum):
    PERMISSION_DENIED = "PERMISSION_DENIED"
    SYMBOLIC_LINK = "SYMBOLIC_LINK"
    ARCHIVE_NOT_SUPPORTED = "ARCHIVE_NOT_SUPPORTED"
    DEPTH_LIMIT = "DEPTH_LIMIT"
    IGNORED_DIRECTORY = "IGNORED_DIRECTORY"
    IO_ERROR = "IO_ERROR"
    UNKNOWN = "UNKNOWN"
```

---

# Recommended Architecture

```text
ExplorerService
 ├── validate_path()
 ├── normalize_path()
 ├── detect_symlink()
 ├── detect_ignored()
 ├── detect_archive()
 ├── check_access()
 ├── enforce_limits()
 ├── scan_directory()
 ├── build_tree()
 └── generate_summary()
```

---

# Traversal Pseudocode

```python
from pathlib import Path

MAX_DEPTH_HARD = 10


def scan_directory(path: Path, level: int = 0):
    if level > MAX_DEPTH_HARD:
        return create_skipped_node("DEPTH_LIMIT")

    if path.is_symlink():
        return create_skipped_node("SYMBOLIC_LINK")

    if is_ignored(path):
        return create_skipped_node("IGNORED_DIRECTORY")

    if is_archive(path):
        return create_skipped_node("ARCHIVE_NOT_SUPPORTED")

    try:
        entries = list(path.iterdir())
    except PermissionError:
        return create_skipped_node("PERMISSION_DENIED")

    children = []

    for entry in entries:
        if entry.is_dir():
            children.append(
                scan_directory(entry, level + 1)
            )

    return build_directory_node(path, children)
```

---

# UX Recommendations

## Deep Nesting Confirmation

Example response:

```json
{
  "requires_confirmation": true,
  "detected_depth": 5,
  "message": "Deep directory nesting detected. Continuing may increase processing time."
}
```

Frontend responsibilities:
- display warning modal,
- explain performance impact,
- request user confirmation.

---

# Security Summary

Protected threats:

| Threat | Protection |
|---|---|
| Symlink traversal | `Path.is_symlink()` |
| Infinite recursion | hard depth limits |
| Huge directory trees | traversal limits |
| Archive bombs | archive skipping |
| Permission crashes | graceful error handling |
| Request blocking | async workers |
| Path escaping | validation layer |

---

# Implementation Priority

## Phase 1
- recursive traversal,
- depth limits,
- symlink detection,
- ignored directories,
- JSON tree generation.

## Phase 2
- async workers,
- traversal progress,
- cancellation support,
- resource enforcement.

## Phase 3
- resumable scans,
- streaming updates,
- incremental traversal,
- filesystem watcher integration.

---

# Final Notes

Traversal should remain:
- deterministic,
- lightweight,
- observable,
- isolated from AI systems.

The explorer is a foundational infrastructure component and must prioritize:
1. safety,
2. predictability,
3. performance,
4. maintainability.
