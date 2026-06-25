"""Best-effort per-client rate limiting (slowapi).

The deterministic protection against a session-creation flood is the hard ``max_sessions`` cap
enforced at creation time (see ``session_service.create_session``); this limiter is only a coarse
first valve. Behind the Next proxy the backend usually sees the proxy's address, so ``key_func``
prefers the first hop of ``X-Forwarded-For`` (set by the proxy) and falls back to the peer address.
"""

from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_client_key)
