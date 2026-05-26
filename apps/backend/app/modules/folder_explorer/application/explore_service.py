from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

from app.modules.folder_explorer.application import depth_confirmation, job_store
from app.modules.folder_explorer.domain.models import (
    MAX_DEPTH_SOFT,
    ExploreJob,
    JobStatus,
)
from app.modules.folder_explorer.infrastructure.traversal import traverse
from app.modules.workspace_path.application.session_store import get_session_path


async def start_explore(session_id: str, extended_depth: bool) -> ExploreJob | None:
    path = get_session_path(session_id)
    if path is None:
        return None

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
