from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any

from app.modules.workflows.application.scan_directory import scan_directory
from app.modules.workflows.domain.models import ExecutionContext

router = APIRouter(prefix="/workflows/api", tags=["workflows"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


class ExecuteWorkflowRequest(BaseModel):
    rootPath: str


@router.post("/execute")
def execute_workflow(body: ExecuteWorkflowRequest) -> dict:
    context = ExecutionContext()
    context.items = scan_directory(body.rootPath)
    return {
        "executionId": str(context.execution_id),
        "startedAt": context.started_at.isoformat(),
        "items": [vars(item) for item in context.items],
        "variables": context.variables,
        "logs": context.logs,
        "outputs": context.outputs,
    }
