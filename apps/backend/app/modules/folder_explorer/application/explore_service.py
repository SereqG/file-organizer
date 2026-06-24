from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from typing import Optional

from app.modules.folder_explorer.application import depth_confirmation, job_store
from app.modules.folder_explorer.domain.models import (
    MAX_DEPTH_SOFT,
    ExploreJob,
    JobStatus,
)
from app.modules.folder_explorer.infrastructure.traversal import traverse
from app.modules.sandbox.application import session_service
from app.modules.sandbox.application.containment import confine


async def start_explore(
    session_id: str,
    extended_depth: bool,
    root_path: Optional[str] = None,
) -> ExploreJob | None:
    """Explore the session's sandbox (or a confined sub-path of it). Returns ``None`` when the
    session is unknown or the requested sub-path escapes the sandbox."""
    sandbox_root = session_service.get_sandbox_root(session_id)
    if sandbox_root is None:
        return None

    if root_path:
        confined, error = confine(session_id, root_path)
        if error is not None:
            return None
        path = confined
    else:
        path = sandbox_root

    session_service.touch_session(session_id)

    job_id = str(uuid.uuid4())
    job = job_store.create_job(job_id)
    effective_depth = depth_confirmation.resolve_effective_depth(extended_depth)

    asyncio.create_task(_run_traversal(job_id, path, effective_depth, extended_depth))
    return job


async def _run_traversal(
    job_id: str,
    path: Path,
    max_depth: int,
    extended: bool,
) -> None:
    job = job_store.get_job(job_id)
    if job is None:
        return

    job_store.update_job(job.model_copy(update={"status": JobStatus.RUNNING}))

    try:
        loop = asyncio.get_running_loop()
        tree = await loop.run_in_executor(None, traverse, path, max_depth)

        if not extended and depth_confirmation.tree_hit_soft_limit(tree):
            job_store.update_job(job.model_copy(update={
                "status": JobStatus.AWAITING_CONFIRMATION,
                "tree": tree,
                "requires_confirmation": True,
                "detected_depth": MAX_DEPTH_SOFT + 1,
            }))
        else:
            job_store.update_job(job.model_copy(update={
                "status": JobStatus.COMPLETE,
                "tree": tree,
            }))
    except Exception as exc:
        job_store.update_job(job.model_copy(update={
            "status": JobStatus.FAILED,
            "error": str(exc),
        }))
