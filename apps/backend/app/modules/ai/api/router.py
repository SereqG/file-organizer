from fastapi import APIRouter

router = APIRouter(prefix="/ai/api", tags=["ai"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}
