"""Persistence for saved workflow definitions (the ``workflows`` table).

A definition is the client ``WorkflowDefinition`` JSON, stored verbatim and keyed by ``session_id``
so a session only ever sees its own saved workflows. Uses the shared sandbox SQLite helper — the
demo is single-process, portfolio scale, so a thin repository over stdlib ``sqlite3`` is enough.
"""

from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass
from typing import Optional

from app.modules.sandbox.infrastructure import db


@dataclass(frozen=True)
class WorkflowSummary:
    """List view of a saved workflow — omits the (potentially large) definition JSON."""

    id: str
    name: str
    created_at: float
    updated_at: float


@dataclass(frozen=True)
class WorkflowRecord:
    id: str
    name: str
    definition: dict
    created_at: float
    updated_at: float


def save_definition(session_id: str, name: str, definition: dict) -> str:
    """Insert a new saved workflow for the session and return its id."""
    workflow_id = uuid.uuid4().hex
    now = time.time()
    with db.connection() as conn:
        conn.execute(
            "INSERT INTO workflows (id, session_id, name, definition_json, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (workflow_id, session_id, name, json.dumps(definition), now, now),
        )
    return workflow_id


def list_definitions(session_id: str) -> list[WorkflowSummary]:
    with db.connection() as conn:
        rows = conn.execute(
            "SELECT id, name, created_at, updated_at FROM workflows"
            " WHERE session_id = ? ORDER BY updated_at DESC",
            (session_id,),
        ).fetchall()
    return [
        WorkflowSummary(id=r["id"], name=r["name"], created_at=r["created_at"], updated_at=r["updated_at"])
        for r in rows
    ]


def get_definition(session_id: str, workflow_id: str) -> Optional[WorkflowRecord]:
    with db.connection() as conn:
        row = conn.execute(
            "SELECT * FROM workflows WHERE id = ? AND session_id = ?",
            (workflow_id, session_id),
        ).fetchone()
    if row is None:
        return None
    return WorkflowRecord(
        id=row["id"],
        name=row["name"],
        definition=json.loads(row["definition_json"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def update_definition(session_id: str, workflow_id: str, name: str, definition: dict) -> bool:
    """Overwrite an existing saved workflow. Returns False when it does not belong to the session."""
    with db.connection() as conn:
        cursor = conn.execute(
            "UPDATE workflows SET name = ?, definition_json = ?, updated_at = ?"
            " WHERE id = ? AND session_id = ?",
            (name, json.dumps(definition), time.time(), workflow_id, session_id),
        )
        return cursor.rowcount > 0


def delete_definition(session_id: str, workflow_id: str) -> bool:
    with db.connection() as conn:
        cursor = conn.execute(
            "DELETE FROM workflows WHERE id = ? AND session_id = ?",
            (workflow_id, session_id),
        )
        return cursor.rowcount > 0
