"""Per-session resource quotas.

The engine already maintains the projected item tree (``context.items``) for both dry-run and real
runs, so the current/predicted usage is derived from it directly — no disk walk needed. The engine
calls this after each node: a dry-run surfaces a breach as a warning, a real run aborts.

Items are duck-typed (``type``/``size``/``path``) to keep this slice free of the workflows domain.
"""

from __future__ import annotations

from typing import Optional

from app.config import settings


def check_quota(items: list, root_path: str) -> Optional[str]:
    """Return an error message if ``items`` exceed any per-session quota, else ``None``."""
    files = 0
    folders = 0
    total_bytes = 0
    for item in items:
        if item.type == "file":
            files += 1
            total_bytes += item.size or 0
        elif item.path != root_path:  # the workflow root itself does not count against the folder cap
            folders += 1

    if files > settings.quota_max_files:
        return f"Sandbox would exceed the file limit of {settings.quota_max_files} files."
    if folders > settings.quota_max_folders:
        return f"Sandbox would exceed the folder limit of {settings.quota_max_folders} folders."
    if total_bytes > settings.quota_max_bytes:
        limit_mb = settings.quota_max_bytes // (1024 * 1024)
        return f"Sandbox would exceed the size limit of {limit_mb} MB."
    return None
