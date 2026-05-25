from pydantic import BaseModel


class FileRecord(BaseModel):
    name: str
    path: str
    size_bytes: int
    mime_type: str
