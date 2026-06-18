import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import Any, Optional

from app.modules.workflows.application import execution_store
from app.modules.workflows.application.execute_resumable import start_execution
from app.modules.workflows.application.execute_workflow import (
    CANCELLED_ERROR,
    WorkflowExecutionResult,
    execute_workflow as run_workflow,
)
from app.modules.workflows.application.execution_store import ExecutionState
from app.modules.workflows.application.item_tree import items_to_tree
from app.modules.workflows.application.preview_token import (
    preview_token,
    workflow_hash,
    workspace_fingerprint,
)
from app.modules.workflows.application.scan_directory import scan_directory
from app.modules.workflows.domain.models import (
    ExecutionContext,
    ExecutionWarning,
    Workflow,
    WorkflowEdge,
    WorkflowNode,
    WorkflowTrigger,
)

router = APIRouter(prefix="/workflows/api", tags=["workflows"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


class WorkflowEdgeRequest(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None


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
    # "run" performs the workflow; "dryRun" simulates it (no disk writes) and returns a preview.
    mode: str = "run"
    # dryRun only: capture the tree on entry to this node and halt (per-node editor simulation).
    stopBefore: Optional[str] = None
    # run only: the token returned by the preview, used to reject a run against changed inputs.
    previewToken: Optional[str] = None


def _build_workflow(request: WorkflowRequest) -> Workflow:
    return Workflow(
        nodes=[WorkflowNode(**n.model_dump()) for n in request.nodes],
        edges=[
            WorkflowEdge(id=e.id, source=e.source, target=e.target, source_handle=e.sourceHandle)
            for e in request.edges
        ],
        trigger=WorkflowTrigger(**request.trigger.model_dump()),
    )


def _serialize_warnings(warnings: list[ExecutionWarning]) -> list[dict]:
    return [
        {
            "nodeId": warning.node_id,
            "code": warning.code,
            "message": warning.message,
            "itemPath": warning.item_path,
            "targetPath": warning.target_path,
        }
        for warning in warnings
    ]


def _dry_run_preview(context: ExecutionContext, result: WorkflowExecutionResult, token: str) -> dict:
    return {
        "executionId": str(context.execution_id),
        "mode": "dryRun",
        "ok": result.error is None,
        "error": result.error,
        "actions": [
            {
                "nodeId": action.node_id,
                "kind": action.kind,
                "description": action.description,
                "itemPath": action.item_path,
                "targetPath": action.target_path,
            }
            for action in context.actions
        ],
        "warnings": _serialize_warnings(result.warnings),
        "failedNodes": [{"id": n.id, "error": n.error} for n in result.failed_nodes],
        "configRemap": context.config_remaps,
        # The predicted final workspace shape, for the "Result" tab in the preview modal.
        "finalTree": items_to_tree(context.items, context.root_path),
        "previewToken": token,
    }


def _stop_before_preview(context: ExecutionContext, result: WorkflowExecutionResult) -> dict:
    """Per-node editor simulation: the tree on entry to the stop_before node and the scope there.
    ``ok`` is False when the node was never reached (upstream invalid/unreachable)."""
    reached = context.snapshot_items is not None
    error = result.error
    if not reached and error is None:
        error = "This node is not reachable from the trigger yet, or an upstream node is incomplete."
    return {
        "executionId": str(context.execution_id),
        "mode": "dryRun",
        "ok": reached and result.error is None,
        "error": error,
        "predictedTree": items_to_tree(context.snapshot_items, context.root_path) if reached else None,
        "scopeItemIds": sorted(context.snapshot_scope_ids),
        "warnings": _serialize_warnings(result.warnings),
    }


def _serialize_state(state: ExecutionState) -> dict:
    """Status payload for the polling endpoint. Live warnings come from the context so they show
    while suspended; the full result fields appear once the run completes."""
    result = state.result
    error = result.error if result and result.error != CANCELLED_ERROR else None
    payload: dict = {
        "executionId": state.execution_id,
        "status": state.status,
        "currentNodeId": state.current_node_id,
        "pendingDecision": state.pending_decision,
        "error": error,
        "failedNodes": [{"id": n.id, "error": n.error} for n in (result.failed_nodes if result else [])],
        "warnings": _serialize_warnings(state.context.warnings),
        "logEntries": [
            {
                "nodeId": e.node_id,
                "nodeName": e.node_name,
                "kind": e.kind,
                "itemName": e.item_name,
                "message": e.message,
                "elapsed": round(e.elapsed, 3),
            }
            for e in state.context.log_entries
        ],
    }
    if state.status == "completed":
        payload["items"] = [vars(item) for item in state.context.items]
        payload["outputs"] = state.context.outputs
        payload["nodeIds"] = result.executed_node_ids if result else []
        payload["configRemap"] = state.context.config_remaps
    return payload


@router.post("/execute")
async def execute_workflow(body: ExecuteWorkflowRequest):
    context = ExecutionContext()
    context.root_path = body.rootPath
    context.items = scan_directory(body.rootPath)

    workflow = _build_workflow(body.workflow)

    # Token over the fresh scan + the as-posted workflow, computed BEFORE any dry-run mutation or
    # in-run config remap, so preview and run agree when nothing changed.
    token = preview_token(workspace_fingerprint(context.items), workflow_hash(body.workflow.model_dump()))

    if body.mode == "dryRun":
        context.dry_run = True
        if body.stopBefore:
            result = run_workflow(workflow, context, stop_before=body.stopBefore)
            return _stop_before_preview(context, result)
        result = run_workflow(workflow, context)
        return _dry_run_preview(context, result, token)

    if not body.previewToken:
        return JSONResponse(
            status_code=409,
            content={"error": "Run requires a fresh preview.", "code": "PREVIEW_REQUIRED"},
        )
    if body.previewToken != token:
        return JSONResponse(
            status_code=409,
            content={"error": "The workspace or workflow changed since the preview. Review again.", "code": "PREVIEW_STALE"},
        )

    execution_id = await start_execution(workflow, context)
    return JSONResponse(status_code=202, content={"executionId": execution_id, "status": "running"})


@router.get("/execute/{execution_id}")
def get_execution(execution_id: str):
    state = execution_store.get(execution_id)
    if state is None:
        return JSONResponse(status_code=404, content={"error": "Execution not found."})
    return _serialize_state(state)


def _serialize_log_entry(e) -> str:
    return json.dumps({
        "nodeId": e.node_id,
        "nodeName": e.node_name,
        "kind": e.kind,
        "itemName": e.item_name,
        "message": e.message,
        "elapsed": round(e.elapsed, 3),
    })


@router.get("/execute/{execution_id}/logs")
async def stream_execution_logs(execution_id: str):
    state = execution_store.get(execution_id)
    if state is None:
        return JSONResponse(status_code=404, content={"error": "Execution not found."})

    async def generate():
        cursor = 0
        while True:
            entries = state.context.log_entries
            if len(entries) > cursor:
                for entry in entries[cursor:]:
                    yield f"data: {_serialize_log_entry(entry)}\n\n"
                cursor = len(entries)
            if state.is_terminal() and cursor >= len(state.context.log_entries):
                break
            await asyncio.sleep(0.05)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class ResumeRequest(BaseModel):
    decision: dict[str, Any]


@router.post("/execute/{execution_id}/resume")
def resume_execution(execution_id: str, body: ResumeRequest):
    state = execution_store.get(execution_id)
    if state is None:
        return JSONResponse(status_code=404, content={"error": "Execution not found."})
    if not execution_store.resume(state, body.decision):
        return JSONResponse(status_code=409, content={"error": "Execution is not awaiting input."})
    return {"executionId": execution_id, "status": "running"}


@router.post("/execute/{execution_id}/cancel")
def cancel_execution(execution_id: str):
    state = execution_store.get(execution_id)
    if state is None:
        return JSONResponse(status_code=404, content={"error": "Execution not found."})
    execution_store.cancel(state)
    return {"executionId": execution_id, "status": "cancelling"}
