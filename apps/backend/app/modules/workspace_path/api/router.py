import uuid

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.modules.workspace_path.application.path_validator import validate_path
from app.modules.workspace_path.application import session_store

router = APIRouter(prefix="/workspace_path/api", tags=["workspace_path"])


class GetPathRequest(BaseModel):
    path: str


class GetPathResponse(BaseModel):
    session_id: str


class PathValidationErrorResponse(BaseModel):
    code: str
    message: str


@router.post("/get_path", response_model=GetPathResponse)
def get_path(body: GetPathRequest):
    canonical_path, error = validate_path(body.path)

    if error is not None:
        return JSONResponse(
            status_code=400,
            content=PathValidationErrorResponse(
                code=error.code,
                message=error.message,
            ).model_dump(),
        )

    generated_id = str(uuid.uuid4())
    session_store.store_session(generated_id, canonical_path)
    return GetPathResponse(session_id=generated_id)
