"""Session lifecycle: provision a seeded, throwaway sandbox per visitor and track its activity.

A session row owns exactly one directory under ``settings.sandbox_root``. Creating a session copies
the seed template into it and adds the empty destination folders a visitor sorts files into.
"""

from __future__ import annotations

import shutil
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from app.config import settings
from app.modules.sandbox.infrastructure import db

_SANDBOX_TEMPLATE_ROOT = Path(__file__).resolve().parents[4] / "sandbox_template"

# Default template: Downloads/ with mixed files + empty destination folders.
_TEMPLATE_DIR = _SANDBOX_TEMPLATE_ROOT
_EMPTY_FOLDERS = ("Documents", "Photos", "Invoices")

# Named variants for pre-built workflow demos.
_TEMPLATE_VARIANTS: dict[str, Path] = {
    "downloads_sorter": _SANDBOX_TEMPLATE_ROOT / "downloads_sorter",
    "document_classifier": _SANDBOX_TEMPLATE_ROOT / "document_classifier",
    "code_organizer": _SANDBOX_TEMPLATE_ROOT / "code_organizer",
}


class SandboxCapacityError(Exception):
    """Raised when the global live-sandbox cap is reached, so no new sandbox may be provisioned.

    Rejecting the newcomer (rather than evicting a live session to make room) keeps a flood from
    pushing real visitors out; the TTL sweep frees capacity as idle sandboxes expire.
    """


@dataclass(frozen=True)
class Session:
    id: str
    sandbox_path: str
    created_at: float
    last_active_at: float


def _row_to_session(row) -> Session:
    return Session(
        id=row["id"],
        sandbox_path=row["sandbox_path"],
        created_at=row["created_at"],
        last_active_at=row["last_active_at"],
    )


def _live_session_count() -> int:
    with db.connection() as conn:
        return conn.execute("SELECT COUNT(*) AS n FROM sessions").fetchone()["n"]


def create_session(template_variant: Optional[str] = None) -> Session:
    """Provision a new session: a fresh sandbox dir seeded from the template, plus a DB row.

    Enforces the global cap *before* doing any filesystem work, so a creation flood cannot exceed
    ``max_sessions`` between cleanup sweeps. Raises ``SandboxCapacityError`` when full.

    When ``template_variant`` matches a named variant the corresponding pre-built demo tree is used
    instead of the default template; unknown values fall back to the default silently.
    """
    if _live_session_count() >= settings.max_sessions:
        raise SandboxCapacityError()

    session_id = uuid.uuid4().hex
    sandbox_path = Path(settings.sandbox_root) / session_id
    sandbox_path.parent.mkdir(parents=True, exist_ok=True)

    template_dir = _TEMPLATE_VARIANTS.get(template_variant or "", _TEMPLATE_DIR)
    if template_dir.exists():
        shutil.copytree(template_dir, sandbox_path)
    else:
        sandbox_path.mkdir()

    if template_variant is None:
        for folder in _EMPTY_FOLDERS:
            (sandbox_path / folder).mkdir(exist_ok=True)

    now = time.time()
    with db.connection() as conn:
        conn.execute(
            "INSERT INTO sessions (id, created_at, last_active_at, sandbox_path) VALUES (?, ?, ?, ?)",
            (session_id, now, now, str(sandbox_path)),
        )
    return Session(id=session_id, sandbox_path=str(sandbox_path), created_at=now, last_active_at=now)


def get_session(session_id: str) -> Optional[Session]:
    with db.connection() as conn:
        row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    return _row_to_session(row) if row is not None else None


def get_sandbox_root(session_id: str) -> Optional[Path]:
    session = get_session(session_id)
    return Path(session.sandbox_path) if session is not None else None


def touch_session(session_id: str) -> None:
    """Mark the session active so the cleanup task does not reclaim it mid-use."""
    with db.connection() as conn:
        conn.execute(
            "UPDATE sessions SET last_active_at = ? WHERE id = ?",
            (time.time(), session_id),
        )


def delete_session(session_id: str) -> None:
    """Remove a session: its sandbox directory, its run log files, and all of its DB rows.

    Run rows cascade with the session, but the ``logs/execution-*.log`` files they reference live
    outside the sandbox tree, so they must be unlinked explicitly or they leak forever.
    """
    session = get_session(session_id)
    if session is not None:
        shutil.rmtree(session.sandbox_path, ignore_errors=True)
    with db.connection() as conn:
        # Read the log paths before deleting the session row (the runs cascade would drop them).
        log_paths = [
            row["log_path"]
            for row in conn.execute(
                "SELECT log_path FROM runs WHERE session_id = ? AND log_path IS NOT NULL",
                (session_id,),
            ).fetchall()
        ]
        conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    for log_path in log_paths:
        try:
            Path(log_path).unlink(missing_ok=True)
        except OSError:
            pass  # a stuck log file must not block reclaiming the session.


def list_sessions() -> list[Session]:
    with db.connection() as conn:
        rows = conn.execute("SELECT * FROM sessions ORDER BY last_active_at ASC").fetchall()
    return [_row_to_session(row) for row in rows]
