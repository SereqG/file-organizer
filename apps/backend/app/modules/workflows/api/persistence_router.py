"""Persistence endpoints: saved workflows (save/load) and run history.

Kept on the ``/workflows/api`` prefix (these are workflow resources) but in a separate router from
the execution endpoints so each file stays focused. Every request is scoped to a session — the
``session_id`` is supplied by the same-origin Next proxy from the httpOnly cookie, never the client.
"""

from __future__ import annotations

import json

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Any, Optional

from app.config import settings
from app.modules.sandbox.application import session_service
from app.modules.workflows.application import definition_store, run_store

router = APIRouter(prefix="/workflows/api", tags=["workflows-persistence"])


def _session_missing(session_id: str) -> bool:
    return session_service.get_session(session_id) is None


def _no_session() -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content={"code": "SESSION_NOT_FOUND", "message": "Session not found or expired."},
    )


def _too_large(definition: dict[str, Any]) -> Optional[JSONResponse]:
    """Reject oversized definitions so a visitor cannot push large blobs into the DB."""
    if len(json.dumps(definition)) > settings.max_definition_bytes:
        return JSONResponse(
            status_code=400,
            content={"code": "DEFINITION_TOO_LARGE", "message": "This workflow is too large to save."},
        )
    return None


# --- saved workflows -------------------------------------------------------


class SaveDefinitionRequest(BaseModel):
    session_id: str
    name: str
    definition: dict[str, Any]


@router.post("/definitions")
def create_definition(body: SaveDefinitionRequest):
    if _session_missing(body.session_id):
        return _no_session()
    if (oversized := _too_large(body.definition)) is not None:
        return oversized
    if definition_store.count_definitions(body.session_id) >= settings.max_definitions_per_session:
        return JSONResponse(
            status_code=409,
            content={"code": "DEFINITION_LIMIT", "message": "Saved-workflow limit reached for this session."},
        )
    workflow_id = definition_store.save_definition(body.session_id, body.name, body.definition)
    return {"id": workflow_id}


@router.get("/definitions")
def list_definitions(session_id: str):
    if _session_missing(session_id):
        return _no_session()
    items = definition_store.list_definitions(session_id)
    return {
        "definitions": [
            {"id": w.id, "name": w.name, "createdAt": w.created_at, "updatedAt": w.updated_at}
            for w in items
        ]
    }


@router.get("/definitions/{workflow_id}")
def get_definition(workflow_id: str, session_id: str):
    if _session_missing(session_id):
        return _no_session()
    record = definition_store.get_definition(session_id, workflow_id)
    if record is None:
        return JSONResponse(status_code=404, content={"code": "NOT_FOUND", "message": "Workflow not found."})
    return {
        "id": record.id,
        "name": record.name,
        "definition": record.definition,
        "createdAt": record.created_at,
        "updatedAt": record.updated_at,
    }


@router.put("/definitions/{workflow_id}")
def update_definition(workflow_id: str, body: SaveDefinitionRequest):
    if _session_missing(body.session_id):
        return _no_session()
    if (oversized := _too_large(body.definition)) is not None:
        return oversized
    if not definition_store.update_definition(body.session_id, workflow_id, body.name, body.definition):
        return JSONResponse(status_code=404, content={"code": "NOT_FOUND", "message": "Workflow not found."})
    return {"id": workflow_id}


@router.delete("/definitions/{workflow_id}")
def delete_definition(workflow_id: str, session_id: str):
    if _session_missing(session_id):
        return _no_session()
    if not definition_store.delete_definition(session_id, workflow_id):
        return JSONResponse(status_code=404, content={"code": "NOT_FOUND", "message": "Workflow not found."})
    return {"id": workflow_id}


# --- run history -----------------------------------------------------------


@router.get("/runs")
def list_runs(session_id: str):
    if _session_missing(session_id):
        return _no_session()
    runs = run_store.list_runs(session_id)
    return {
        "runs": [
            {
                "id": r.id,
                "status": r.status,
                "startedAt": r.started_at,
                "finishedAt": r.finished_at,
                "summary": r.summary,
            }
            for r in runs
        ]
    }


@router.get("/runs/{run_id}")
def get_run(run_id: str, session_id: str):
    if _session_missing(session_id):
        return _no_session()
    run = run_store.get_run(session_id, run_id)
    if run is None:
        return JSONResponse(status_code=404, content={"code": "NOT_FOUND", "message": "Run not found."})
    return {
        "id": run.id,
        "status": run.status,
        "startedAt": run.started_at,
        "finishedAt": run.finished_at,
        "summary": run.summary,
        "log": run.log,
    }
