import asyncio
import hmac
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.rate_limit import limiter
from app.modules.ai.api.router import router as ai_router
from app.modules.files.api.router import router as files_router
from app.modules.folder_explorer.api.router import router as folder_explorer_router
from app.modules.sandbox.api.router import router as sandbox_router
from app.modules.sandbox.application.cleanup import run_cleanup_loop
from app.modules.workflows.api.persistence_router import router as workflows_persistence_router
from app.modules.workflows.api.router import router as workflows_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Reclaim idle sandboxes (disk + DB rows) on an interval for the whole app lifetime.
    cleanup_task = asyncio.create_task(run_cleanup_loop())
    try:
        yield
    finally:
        cleanup_task.cancel()


app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

# Best-effort rate limiting on hot endpoints (e.g. session creation); see app/rate_limit.py.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Paths reachable without the shared secret: the docker healthcheck (called from inside the
# container with no header) and the auto-generated API docs.
_SECRET_EXEMPT_PATHS = frozenset({"/workflows/api/health", "/docs", "/redoc", "/openapi.json"})


@app.middleware("http")
async def require_internal_secret(request: Request, call_next):
    """Defense-in-depth: when configured, require the proxy's shared secret so a direct hit on the
    internal-only backend is rejected rather than trusted. No-op when the secret is unset (dev)."""
    secret = settings.internal_api_secret
    if secret and request.url.path not in _SECRET_EXEMPT_PATHS:
        provided = request.headers.get("X-Internal-Secret", "")
        if not hmac.compare_digest(provided, secret):
            return JSONResponse(status_code=401, content={"code": "UNAUTHORIZED", "message": "Not authorized."})
    return await call_next(request)


app.include_router(files_router)
app.include_router(workflows_router)
app.include_router(workflows_persistence_router)
app.include_router(ai_router)
app.include_router(sandbox_router)
app.include_router(folder_explorer_router)

if __name__ == "__main__":
    # reload_dirs scopes the watcher to source only. Without it the reloader also watches runtime
    # data (var/sandboxes, logs) under the backend root, so seeding a sandbox's .py files would
    # restart the worker mid-request and wipe in-memory state (e.g. the explore job store).
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        reload_dirs=["app"],
    )
