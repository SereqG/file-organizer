from fastapi import APIRouter

router = APIRouter(prefix="/workflows/api", tags=["workflows"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}
