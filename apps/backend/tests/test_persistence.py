"""Stage 3 — saved-workflow CRUD and run-history persistence (repositories + API).

Definitions and runs are both scoped by session: a session must never read or mutate another's
rows. These tests drive the repositories directly and the router via the test client.
"""

import time
import uuid

from app.modules.sandbox.infrastructure import db
from app.modules.workflows.application import definition_store, run_store


def _make_session(sandbox_path="/tmp/none") -> str:
    session_id = uuid.uuid4().hex
    now = time.time()
    with db.connection() as conn:
        conn.execute(
            "INSERT INTO sessions (id, created_at, last_active_at, sandbox_path) VALUES (?, ?, ?, ?)",
            (session_id, now, now, str(sandbox_path)),
        )
    return session_id


_DEFINITION = {"version": "1.0", "trigger": {"id": "trigger-1"}, "nodes": [], "edges": []}


# --- definition repository -------------------------------------------------


def test_save_and_get_definition():
    session = _make_session()
    workflow_id = definition_store.save_definition(session, "My Flow", _DEFINITION)

    record = definition_store.get_definition(session, workflow_id)
    assert record is not None
    assert record.name == "My Flow"
    assert record.definition == _DEFINITION


def test_list_definitions_scoped_to_session():
    session_a = _make_session()
    session_b = _make_session()
    definition_store.save_definition(session_a, "A1", _DEFINITION)
    definition_store.save_definition(session_a, "A2", _DEFINITION)
    definition_store.save_definition(session_b, "B1", _DEFINITION)

    assert {d.name for d in definition_store.list_definitions(session_a)} == {"A1", "A2"}
    assert {d.name for d in definition_store.list_definitions(session_b)} == {"B1"}


def test_get_definition_rejects_other_session():
    owner = _make_session()
    intruder = _make_session()
    workflow_id = definition_store.save_definition(owner, "Owned", _DEFINITION)

    assert definition_store.get_definition(intruder, workflow_id) is None


def test_update_definition():
    session = _make_session()
    workflow_id = definition_store.save_definition(session, "Old", _DEFINITION)

    changed = {**_DEFINITION, "nodes": [{"id": "n1"}]}
    assert definition_store.update_definition(session, workflow_id, "New", changed) is True

    record = definition_store.get_definition(session, workflow_id)
    assert record.name == "New" and record.definition == changed


def test_update_definition_rejects_other_session():
    owner = _make_session()
    intruder = _make_session()
    workflow_id = definition_store.save_definition(owner, "Owned", _DEFINITION)

    assert definition_store.update_definition(intruder, workflow_id, "Hijacked", _DEFINITION) is False
    assert definition_store.get_definition(owner, workflow_id).name == "Owned"


def test_delete_definition():
    session = _make_session()
    workflow_id = definition_store.save_definition(session, "Doomed", _DEFINITION)

    assert definition_store.delete_definition(session, workflow_id) is True
    assert definition_store.get_definition(session, workflow_id) is None
    assert definition_store.delete_definition(session, workflow_id) is False  # already gone


# --- run repository --------------------------------------------------------


def test_record_start_then_finish(tmp_path):
    session = _make_session()
    log = tmp_path / "execution-r1.log"
    log.write_text("the log body", encoding="utf-8")

    run_store.record_start("r1", session, str(log))
    run_store.record_finish("r1", session, "completed", {"executedNodes": 3, "warnings": 0})

    detail = run_store.get_run(session, "r1")
    assert detail.status == "completed"
    assert detail.summary == {"executedNodes": 3, "warnings": 0}
    assert detail.log == "the log body"
    assert detail.finished_at is not None


def test_record_start_noop_without_session(tmp_path):
    # Engine/unit runs carry no session — recording must be a silent no-op, not a DB error.
    run_store.record_start("r-none", "", str(tmp_path / "x.log"))
    assert run_store.list_runs("") == []


def test_list_runs_scoped_to_session(tmp_path):
    session_a = _make_session()
    session_b = _make_session()
    run_store.record_start("a1", session_a, str(tmp_path / "a1.log"))
    run_store.record_start("b1", session_b, str(tmp_path / "b1.log"))

    assert {r.id for r in run_store.list_runs(session_a)} == {"a1"}
    assert run_store.get_run(session_b, "a1") is None


# --- API ------------------------------------------------------------------


def test_definitions_api_roundtrip(client):
    session = _make_session()
    save = client.post("/workflows/api/definitions", json={"session_id": session, "name": "Flow", "definition": _DEFINITION})
    assert save.status_code == 200
    workflow_id = save.json()["id"]

    listed = client.get("/workflows/api/definitions", params={"session_id": session})
    assert listed.status_code == 200
    assert [d["name"] for d in listed.json()["definitions"]] == ["Flow"]

    fetched = client.get(f"/workflows/api/definitions/{workflow_id}", params={"session_id": session})
    assert fetched.json()["definition"] == _DEFINITION

    deleted = client.delete(f"/workflows/api/definitions/{workflow_id}", params={"session_id": session})
    assert deleted.status_code == 200
    assert client.get("/workflows/api/definitions", params={"session_id": session}).json()["definitions"] == []


def test_definitions_api_rejects_unknown_session(client):
    res = client.post("/workflows/api/definitions", json={"session_id": "nope", "name": "x", "definition": _DEFINITION})
    assert res.status_code == 404
    assert res.json()["code"] == "SESSION_NOT_FOUND"


def test_definition_rejected_when_too_large(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "max_definition_bytes", 50)
    session = _make_session()
    big = {**_DEFINITION, "nodes": [{"id": "x" * 200}]}
    res = client.post("/workflows/api/definitions", json={"session_id": session, "name": "big", "definition": big})
    assert res.status_code == 400
    assert res.json()["code"] == "DEFINITION_TOO_LARGE"


def test_definition_count_capped_per_session(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "max_definitions_per_session", 1)
    session = _make_session()
    first = client.post("/workflows/api/definitions", json={"session_id": session, "name": "a", "definition": _DEFINITION})
    assert first.status_code == 200
    second = client.post("/workflows/api/definitions", json={"session_id": session, "name": "b", "definition": _DEFINITION})
    assert second.status_code == 409
    assert second.json()["code"] == "DEFINITION_LIMIT"


def test_runs_api_lists_history(client, tmp_path):
    session = _make_session()
    log = tmp_path / "execution-run9.log"
    log.write_text("history log", encoding="utf-8")
    run_store.record_start("run9", session, str(log))
    run_store.record_finish("run9", session, "completed", {"executedNodes": 1, "warnings": 0})

    listed = client.get("/workflows/api/runs", params={"session_id": session})
    assert listed.status_code == 200
    assert [r["id"] for r in listed.json()["runs"]] == ["run9"]

    detail = client.get("/workflows/api/runs/run9", params={"session_id": session})
    assert detail.json()["log"] == "history log"
    assert detail.json()["status"] == "completed"
