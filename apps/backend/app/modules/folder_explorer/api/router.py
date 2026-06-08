from typing import Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.modules.folder_explorer.application import job_store
from app.modules.folder_explorer.application.explore_service import start_explore
from app.modules.folder_explorer.domain.models import ExploreJob

router = APIRouter(prefix="/folder_explorer/api", tags=["folder_explorer"])


class ExploreRequest(BaseModel):
    session_id: str
    root_path: Optional[str] = None
    extended_depth: bool = False


class ExploreStartResponse(BaseModel):
    job_id: str


@router.post("/explore", response_model=ExploreStartResponse)
async def post_explore(body: ExploreRequest):
    job = await start_explore(body.session_id, body.extended_depth, body.root_path)

    if job is None:
        return JSONResponse(
            status_code=404,
            content={"code": "SESSION_NOT_FOUND", "message": "Session ID not found or expired."},
        )

    return ExploreStartResponse(job_id=job.job_id)


@router.get("/explore/{job_id}", response_model=ExploreJob)
def get_explore(job_id: str):
    job = job_store.get_job(job_id)

    if job is None:
        return JSONResponse(
            status_code=404,
            content={"code": "JOB_NOT_FOUND", "message": "Job ID not found."},
        )

    return job
