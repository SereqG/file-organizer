from fastapi import APIRouter

router = APIRouter(prefix="/files/api", tags=["files"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}
