import time
import uuid

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.modules.sandbox.infrastructure import db


@pytest.fixture(autouse=True)
def isolated_storage(tmp_path_factory, monkeypatch):
    """Point the SQLite database and sandbox root at a per-test temp dir (kept separate from the
    test's own ``tmp_path`` workspace) so tests never touch the real ``var/`` data and always start
    from an empty database."""
    storage = tmp_path_factory.mktemp("storage")
    monkeypatch.setattr(settings, "sqlite_path", str(storage / "app.db"))
    monkeypatch.setattr(settings, "sandbox_root", str(storage / "sandboxes"))
    yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def make_session():
    """Register a session row whose sandbox is an existing directory, without seeding a template.
    Lets a test treat its own ``tmp_path`` as the confined sandbox."""
    def _make(sandbox_path) -> str:
        session_id = uuid.uuid4().hex
        now = time.time()
        with db.connection() as conn:
            conn.execute(
                "INSERT INTO sessions (id, created_at, last_active_at, sandbox_path) VALUES (?, ?, ?, ?)",
                (session_id, now, now, str(sandbox_path)),
            )
        return session_id
    return _make
