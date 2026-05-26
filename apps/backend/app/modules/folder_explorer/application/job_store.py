from __future__ import annotations

from app.modules.folder_explorer.domain.models import ExploreJob, JobStatus

_jobs: dict[str, ExploreJob] = {}


def create_job(job_id: str) -> ExploreJob:
    job = ExploreJob(job_id=job_id, status=JobStatus.PENDING)
    _jobs[job_id] = job
    return job


def get_job(job_id: str) -> ExploreJob | None:
    return _jobs.get(job_id)


def update_job(job: ExploreJob) -> None:
    _jobs[job.job_id] = job
