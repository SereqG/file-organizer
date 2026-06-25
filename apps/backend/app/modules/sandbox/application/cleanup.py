"""Periodic reclamation of idle sandboxes.

A dependency-free asyncio task (started from the FastAPI lifespan) deletes sessions whose sandbox
has been idle longer than the TTL, and enforces a global cap on live sandboxes. Deleting a session
frees both disk (its directory) and DB rows (workflows/runs cascade). Modelled on the
execution_store TTL/GC pattern, but this one actually reclaims disk.
"""

from __future__ import annotations

import asyncio
import time

from app.config import settings
from app.modules.sandbox.application import session_service


def cleanup_once() -> int:
    """Reclaim expired sandboxes and trim down to the global cap. Returns the number reclaimed."""
    sessions = session_service.list_sessions()  # oldest (least recently active) first
    cutoff = time.time() - settings.session_ttl_seconds

    expired = {s.id for s in sessions if s.last_active_at < cutoff}
    # Beyond the cap, drop the oldest survivors too.
    survivors = [s for s in sessions if s.id not in expired]
    overflow = max(0, len(survivors) - settings.max_sessions)
    to_delete = expired | {s.id for s in survivors[:overflow]}

    for session_id in to_delete:
        session_service.delete_session(session_id)
    return len(to_delete)


async def run_cleanup_loop() -> None:
    """Sweep on the configured interval until cancelled (FastAPI shutdown)."""
    while True:
        try:
            await asyncio.sleep(settings.cleanup_interval_seconds)
            # Offload the blocking rmtree/DB work so a sweep never stalls the event loop.
            await asyncio.to_thread(cleanup_once)
        except asyncio.CancelledError:
            return
        except Exception:  # noqa: BLE001 - a sweep failure must not kill the loop.
            continue
