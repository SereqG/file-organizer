from __future__ import annotations

from pathlib import Path

_sessions: dict[str, str] = {}


def store_session(session_id: str, path: Path) -> None:
    _sessions[session_id] = str(path)


def get_session_path(session_id: str) -> Path | None:
    value = _sessions.get(session_id)
    return Path(value) if value is not None else None
