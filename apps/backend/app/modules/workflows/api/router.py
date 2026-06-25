import asyncio
import json
import os

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import Any, Optional

from app.config import settings
from app.modules.sandbox.application import session_service
from app.modules.sandbox.application.containment import confine
from app.shared.ownership import session_owner_guard
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
    # The session that owns the sandbox; the root and every node path are confined to it.
    session_id: str
    rootPath: str
    # "run" performs the workflow; "dryRun" simulates it (no disk writes) and returns a preview.
    mode: str = "run"
    # dryRun only: capture the tree on entry to this node and halt (per-node editor simulation).
    stopBefore: Optional[str] = None
    # run only: the token returned by the preview, used to reject a run against changed inputs.
    previewToken: Optional[str] = None
    # The caller's OpenRouter API key (stored client-side only). Used by AI nodes; never persisted.
    apiKey: Optional[str] = None


# Path fields a node config may carry, by node type. Every one is containment-checked before a run.
_NODE_SINGLE_PATH_FIELDS = {
    "createFolder": "parentFolderPath",
    "renameFolder": "folderPath",
    "renameFile": "filePath",
    "moveFile": "targetPath",
    "moveFolder": "targetPath",
}
_NODE_LIST_PATH_FIELDS = {
    "deleteFolder": "folderPaths",
    "deleteFile": "filePaths",
    "copyFile": "targetPaths",
    "copyFolder": "targetPaths",
}
# Name fields (not paths): appended to a parent directory, so they must not contain a separator or
# traversal of their own, or they could escape the sandbox before guard_target's write-time check.
_NODE_NAME_FIELDS = {
    "createFolder": "folderName",
    "renameFolder": "newName",
    "renameFile": "newName",
}


def _is_unsafe_name(value: str) -> bool:
    """A name must be a single path segment — no separators, no absolute path, no bare ``.``/``..``."""
    return os.path.isabs(value) or "/" in value or "\\" in value or value in (".", "..")


def _confine_node_paths(session_id: str, workflow: WorkflowRequest) -> Optional[str]:
    """Reject the run if any node config path escapes the sandbox. Only containment is enforced —
    not existence — because an upstream node may create the path during the run."""
    def check(value: object, node_id: str) -> Optional[str]:
        if isinstance(value, str) and value:
            _, error = confine(session_id, value, must_exist=False, must_be_dir=False)
            if error:
                return f"Node {node_id} references a path outside the sandbox."
        return None

    for node in workflow.nodes:
        single = _NODE_SINGLE_PATH_FIELDS.get(node.type)
        if single:
            error = check(node.config.get(single), node.id)
            if error:
                return error
        listed = _NODE_LIST_PATH_FIELDS.get(node.type)
        if listed:
            for value in node.config.get(listed, []) or []:
                error = check(value, node.id)
                if error:
                    return error
        name_field = _NODE_NAME_FIELDS.get(node.type)
        if name_field:
            name = node.config.get(name_field)
            if isinstance(name, str) and name and _is_unsafe_name(name):
                return f"Node {node.id} has an invalid name."
    return None


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
    # --- containment: the session's sandbox is the only place this run may touch ---
    sandbox_root = session_service.get_sandbox_root(body.session_id)
    if sandbox_root is None:
        return JSONResponse(status_code=400, content={"error": "Session not found or expired.", "code": "SESSION_NOT_FOUND"})

    root, root_error = confine(body.session_id, body.rootPath)
    if root_error is not None:
        return JSONResponse(status_code=400, content={"error": root_error.message, "code": root_error.code})

    path_error = _confine_node_paths(body.session_id, body.workflow)
    if path_error is not None:
        return JSONResponse(status_code=400, content={"error": path_error, "code": "PATH_OUTSIDE_SANDBOX"})

    if len(body.workflow.nodes) > settings.max_workflow_nodes:
        return JSONResponse(
            status_code=400,
            content={"error": f"Workflow exceeds the maximum of {settings.max_workflow_nodes} nodes.", "code": "TOO_MANY_NODES"},
        )

    session_service.touch_session(body.session_id)

    context = ExecutionContext()
    context.session_id = body.session_id
    context.sandbox_root = str(sandbox_root)
    context.root_path = str(root)
    context.api_key = body.apiKey or ""
    context.items = scan_directory(str(root))

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

    # One active run per session — reject a second concurrent run to avoid racing the same sandbox.
    if execution_store.has_active_session_run(body.session_id):
        return JSONResponse(
            status_code=409,
            content={"error": "A run is already in progress for this session.", "code": "RUN_IN_PROGRESS"},
        )

    execution_id = await start_execution(workflow, context)
    return JSONResponse(status_code=202, content={"executionId": execution_id, "status": "running"})


@router.get("/execute/{execution_id}")
def get_execution(execution_id: str, request: Request):
    state = execution_store.get(execution_id)
    if state is None:
        return JSONResponse(status_code=404, content={"error": "Execution not found."})
    if (denied := session_owner_guard(request, state.session_id)) is not None:
        return denied
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
async def stream_execution_logs(execution_id: str, request: Request):
    state = execution_store.get(execution_id)
    if state is None:
        return JSONResponse(status_code=404, content={"error": "Execution not found."})
    if (denied := session_owner_guard(request, state.session_id)) is not None:
        return denied

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
def resume_execution(execution_id: str, body: ResumeRequest, request: Request):
    state = execution_store.get(execution_id)
    if state is None:
        return JSONResponse(status_code=404, content={"error": "Execution not found."})
    if (denied := session_owner_guard(request, state.session_id)) is not None:
        return denied
    if not execution_store.resume(state, body.decision):
        return JSONResponse(status_code=409, content={"error": "Execution is not awaiting input."})
    return {"executionId": execution_id, "status": "running"}


@router.post("/execute/{execution_id}/cancel")
def cancel_execution(execution_id: str, request: Request):
    state = execution_store.get(execution_id)
    if state is None:
        return JSONResponse(status_code=404, content={"error": "Execution not found."})
    if (denied := session_owner_guard(request, state.session_id)) is not None:
        return denied
    execution_store.cancel(state)
    return {"executionId": execution_id, "status": "cancelling"}
