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

# Source tree copied into every new sandbox (apps/backend/sandbox_template).
_TEMPLATE_DIR = Path(__file__).resolve().parents[4] / "sandbox_template"
# Empty destination folders created alongside the seeded Downloads/ tree.
_EMPTY_FOLDERS = ("Documents", "Photos", "Invoices")


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


def create_session() -> Session:
    """Provision a new session: a fresh sandbox dir seeded from the template, plus a DB row."""
    session_id = uuid.uuid4().hex
    sandbox_path = Path(settings.sandbox_root) / session_id
    sandbox_path.parent.mkdir(parents=True, exist_ok=True)

    if _TEMPLATE_DIR.exists():
        shutil.copytree(_TEMPLATE_DIR, sandbox_path)
    else:
        sandbox_path.mkdir()
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
    """Remove a session: its sandbox directory and all of its DB rows (workflows/runs cascade)."""
    session = get_session(session_id)
    if session is not None:
        shutil.rmtree(session.sandbox_path, ignore_errors=True)
    with db.connection() as conn:
        conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))


def list_sessions() -> list[Session]:
    with db.connection() as conn:
        rows = conn.execute("SELECT * FROM sessions ORDER BY last_active_at ASC").fetchall()
    return [_row_to_session(row) for row in rows]
