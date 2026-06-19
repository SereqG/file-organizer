"""Persistence for run history (the ``runs`` table).

Each real run records a row when it starts and updates it when it finishes; the stored ``log_path``
points at the existing ``logs/execution-*.log`` file so history reuses the same log the live run
streamed. Rows are keyed by ``session_id`` so a session only ever sees its own runs.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from app.modules.sandbox.infrastructure import db


@dataclass(frozen=True)
class RunSummary:
    id: str
    status: str
    started_at: Optional[float]
    finished_at: Optional[float]
    summary: Optional[dict]


@dataclass(frozen=True)
class RunDetail:
    id: str
    status: str
    started_at: Optional[float]
    finished_at: Optional[float]
    summary: Optional[dict]
    log: Optional[str]


def record_start(run_id: str, session_id: str, log_path: str, workflow_id: Optional[str] = None) -> None:
    """Insert the run row at launch. No-op without a session (engine/unit runs have none)."""
    if not session_id:
        return
    with db.connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO runs (id, session_id, workflow_id, status, started_at, log_path)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (run_id, session_id, workflow_id, "running", time.time(), log_path),
        )


def record_finish(run_id: str, session_id: str, status: str, summary: dict) -> None:
    """Mark a run terminal and store its summary. No-op without a session."""
    if not session_id:
        return
    with db.connection() as conn:
        conn.execute(
            "UPDATE runs SET status = ?, finished_at = ?, summary_json = ? WHERE id = ?",
            (status, time.time(), json.dumps(summary), run_id),
        )


def _summary(raw: Optional[str]) -> Optional[dict]:
    return json.loads(raw) if raw else None


def list_runs(session_id: str) -> list[RunSummary]:
    with db.connection() as conn:
        rows = conn.execute(
            "SELECT id, status, started_at, finished_at, summary_json FROM runs"
            " WHERE session_id = ? ORDER BY started_at DESC",
            (session_id,),
        ).fetchall()
    return [
        RunSummary(
            id=r["id"],
            status=r["status"],
            started_at=r["started_at"],
            finished_at=r["finished_at"],
            summary=_summary(r["summary_json"]),
        )
        for r in rows
    ]


def get_run(session_id: str, run_id: str) -> Optional[RunDetail]:
    with db.connection() as conn:
        row = conn.execute(
            "SELECT * FROM runs WHERE id = ? AND session_id = ?",
            (run_id, session_id),
        ).fetchone()
    if row is None:
        return None
    log = None
    if row["log_path"]:
        log_file = Path(row["log_path"])
        if log_file.exists():
            log = log_file.read_text(encoding="utf-8")
    return RunDetail(
        id=row["id"],
        status=row["status"],
        started_at=row["started_at"],
        finished_at=row["finished_at"],
        summary=_summary(row["summary_json"]),
        log=log,
    )
