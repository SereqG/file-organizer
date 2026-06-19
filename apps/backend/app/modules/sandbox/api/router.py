"""Session endpoints: provision a seeded sandbox and reattach to an existing one."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from app.modules.sandbox.application import session_service
from app.shared.traversal import FileTreeNode, MAX_DEPTH_HARD, traverse

router = APIRouter(prefix="/sandbox/api", tags=["sandbox"])


class SessionResponse(BaseModel):
    session_id: str
    sandbox_path: str
    tree: Optional[FileTreeNode] = None


def _session_payload(session: session_service.Session) -> SessionResponse:
    tree = traverse(Path(session.sandbox_path), MAX_DEPTH_HARD)
    return SessionResponse(session_id=session.id, sandbox_path=session.sandbox_path, tree=tree)


@router.post("/session", response_model=SessionResponse)
def create_session():
    session = session_service.create_session()
    return _session_payload(session)


@router.get("/session/{session_id}", response_model=SessionResponse)
def get_session(session_id: str):
    session = session_service.get_session(session_id)
    if session is None:
        return JSONResponse(
            status_code=404,
            content={"code": "SESSION_NOT_FOUND", "message": "Session not found or expired."},
        )
    session_service.touch_session(session_id)
    return _session_payload(session)
