import asyncio
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from app.config import settings
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

app.include_router(files_router)
app.include_router(workflows_router)
app.include_router(workflows_persistence_router)
app.include_router(ai_router)
app.include_router(sandbox_router)
app.include_router(folder_explorer_router)

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=settings.debug)
