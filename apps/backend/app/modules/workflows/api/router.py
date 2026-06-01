from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Any

from app.modules.workflows.application.execute_workflow import execute_workflow as run_workflow
from app.modules.workflows.application.scan_directory import scan_directory
from app.modules.workflows.application.trace_workflow import trace_workflow
from app.modules.workflows.domain.models import ExecutionContext, Workflow, WorkflowEdge, WorkflowNode, WorkflowTrigger

router = APIRouter(prefix="/workflows/api", tags=["workflows"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


class WorkflowEdgeRequest(BaseModel):
    id: str
    source: str
    target: str


class WorkflowNodeRequest(BaseModel):
    id: str
    type: str
    category: str
    name: str
    version: int
    config: dict[str, Any]


class WorkflowTriggerRequest(BaseModel):
    id: str
    type: str
    category: str
    name: str
    version: int
    config: dict[str, Any]


class WorkflowRequest(BaseModel):
    nodes: list[WorkflowNodeRequest]
    edges: list[WorkflowEdgeRequest]
    trigger: WorkflowTriggerRequest


class ExecuteWorkflowRequest(BaseModel):
    workflow: WorkflowRequest
    rootPath: str


@router.post("/execute")
def execute_workflow(body: ExecuteWorkflowRequest) -> dict:
    context = ExecutionContext()
    context.root_path = body.rootPath
    context.items = scan_directory(body.rootPath)

    workflow = Workflow(
        nodes=[WorkflowNode(**n.model_dump()) for n in body.workflow.nodes],
        edges=[WorkflowEdge(**e.model_dump()) for e in body.workflow.edges],
        trigger=WorkflowTrigger(**body.workflow.trigger.model_dump()),
    )
    node_ids = trace_workflow(workflow)

    result = run_workflow(workflow, node_ids, context)
    if result.error:
        return JSONResponse(
            status_code=422,
            content={
                "error": result.error,
                "executionId": str(context.execution_id),
                "failedNodes": [{"id": n.id, "error": n.error} for n in result.failed_nodes],
            },
        )

    return {
        "executionId": str(context.execution_id),
        "startedAt": context.started_at.isoformat(),
        "items": [vars(item) for item in context.items],
        "variables": context.variables,
        "logs": context.logs,
        "outputs": context.outputs,
        "nodeIds": node_ids,
        "failedNodes": [],
    }
