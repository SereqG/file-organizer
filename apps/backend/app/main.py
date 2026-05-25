from fastapi import FastAPI

from app.config import settings
from app.modules.ai.api.router import router as ai_router
from app.modules.files.api.router import router as files_router
from app.modules.workflows.api.router import router as workflows_router

app = FastAPI(title=settings.app_name, debug=settings.debug)

app.include_router(files_router)
app.include_router(workflows_router)
app.include_router(ai_router)
