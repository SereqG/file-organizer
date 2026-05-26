import uvicorn
from fastapi import FastAPI

from app.config import settings
from app.modules.ai.api.router import router as ai_router
from app.modules.files.api.router import router as files_router
from app.modules.folder_explorer.api.router import router as folder_explorer_router
from app.modules.workspace_path.api.router import router as workspace_path_router
from app.modules.workflows.api.router import router as workflows_router

app = FastAPI(title=settings.app_name, debug=settings.debug)

app.include_router(files_router)
app.include_router(workflows_router)
app.include_router(ai_router)
app.include_router(workspace_path_router)
app.include_router(folder_explorer_router)

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=settings.debug)
