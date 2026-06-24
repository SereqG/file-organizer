"""SQLite connection helper for the sandbox slice.

Single-process, low-traffic by design (portfolio scale): each call opens a short-lived connection
to ``settings.sqlite_path`` in WAL mode. The schema is applied lazily on first use, so the database
works whether or not the FastAPI lifespan ran (e.g. under the test client).
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from app.config import settings

_SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"

# Tracks which database files have had the schema applied this process, keyed by path so that
# pointing ``settings.sqlite_path`` at a fresh file (as the tests do) re-initialises it.
_initialised: set[str] = set()


def _ensure_initialised(path: str) -> None:
    if path in _initialised:
        return
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as conn:
        conn.executescript(_SCHEMA_PATH.read_text(encoding="utf-8"))
    _initialised.add(path)


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    """Yield a configured SQLite connection, committing on success and always closing."""
    path = settings.sqlite_path
    _ensure_initialised(path)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
