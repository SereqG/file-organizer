"""Session-ownership guard for resources looked up by an opaque id (executions, explore jobs).

These resources are addressed by an unguessable id alone, which is not an authorization boundary.
The owning ``session_id`` is carried in a header the same-origin Next proxy injects from the
httpOnly cookie (never the client body), and compared here. A mismatch returns 404 rather than 403
so a guessed id is not even confirmed to exist.
"""

from __future__ import annotations

from typing import Optional

from fastapi import Request
from fastapi.responses import JSONResponse

SESSION_HEADER = "X-Session-Id"


def request_session_id(request: Request) -> str:
    return request.headers.get(SESSION_HEADER, "")


def session_owner_guard(request: Request, owner_session_id: str) -> Optional[JSONResponse]:
    """Return a 404 response when the request's session does not own the resource, else ``None``."""
    if request_session_id(request) != owner_session_id:
        return JSONResponse(status_code=404, content={"error": "Not found."})
    return None
