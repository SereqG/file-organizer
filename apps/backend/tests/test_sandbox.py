"""Sandboxed-demo guarantees: containment, the write-time guard, quotas, the run lock and cleanup.

These cover the security-critical core (Stage 1) and the safety limits (Stage 2). Engine-level tests
drive ``execute_workflow`` directly with a configured ``sandbox_root``; API tests drive the router.
"""

import time

from app.config import settings
from app.modules.sandbox.application import cleanup, session_service
from app.modules.sandbox.application.containment import confine
from app.modules.sandbox.application.quota import check_quota
from app.modules.workflows.application import execution_store
from app.modules.workflows.application.execute_workflow import WorkflowExecutionResult, execute_workflow
from app.modules.workflows.application.nodes.transfer_helpers import guard_target
from app.modules.workflows.application.scan_directory import scan_directory
from app.modules.workflows.domain.models import (
    ExecutionContext,
    Workflow,
    WorkflowEdge,
    WorkflowItem,
    WorkflowNode,
    WorkflowTrigger,
)


# --- helpers ---------------------------------------------------------------


def node(node_id, node_type, config):
    return WorkflowNode(id=node_id, type=node_type, category="general", name=node_id, version=1, config=config)


def edge(source, target):
    return WorkflowEdge(id=f"{source}->{target}", source=source, target=target)


def workflow(nodes, edges):
    trigger = WorkflowTrigger(id="trigger-1", type="manual_trigger", category="trigger", name="t", version=1, config={})
    return Workflow(nodes=nodes, edges=edges, trigger=trigger)


def sandbox_ctx(root, *, dry_run=False):
    ctx = ExecutionContext()
    ctx.root_path = str(root)
    ctx.sandbox_root = str(root)
    ctx.items = scan_directory(str(root))
    ctx.dry_run = dry_run
    return ctx


def all_ids(ctx):
    return {item.id for item in ctx.items}


# --- session seeding (Stage 0) ---------------------------------------------


def test_create_session_seeds_sandbox():
    from pathlib import Path

    session = session_service.create_session()
    root = Path(session.sandbox_path)
    names = {p.name for p in root.iterdir()}

    assert {"Downloads", "Documents", "Photos", "Invoices"} <= names
    assert any(root.joinpath("Downloads").iterdir())  # template files were copied in


# --- containment (Stage 1) -------------------------------------------------


def test_confine_accepts_path_inside_sandbox(tmp_path, make_session):
    sandbox = tmp_path / "sb"
    (sandbox / "Downloads").mkdir(parents=True)
    session = make_session(sandbox)

    resolved, error = confine(session, str(sandbox / "Downloads"))
    assert error is None
    assert resolved == (sandbox / "Downloads")


def test_confine_rejects_parent_traversal(tmp_path, make_session):
    sandbox = tmp_path / "sb"
    sandbox.mkdir()
    session = make_session(sandbox)

    _, error = confine(session, str(sandbox / ".." / ".." / "etc"))
    assert error is not None
    assert error.code == "PATH_OUTSIDE_SANDBOX"


def test_confine_rejects_absolute_host_path(tmp_path, make_session):
    sandbox = tmp_path / "sb"
    sandbox.mkdir()
    session = make_session(sandbox)

    _, error = confine(session, "/etc")
    assert error is not None
    assert error.code == "PATH_OUTSIDE_SANDBOX"


def test_confine_rejects_symlink_escape(tmp_path, make_session):
    sandbox = tmp_path / "sb"
    sandbox.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    (sandbox / "escape").symlink_to(outside)  # symlink inside the sandbox pointing out
    session = make_session(sandbox)

    _, error = confine(session, str(sandbox / "escape"))
    assert error is not None
    assert error.code == "PATH_OUTSIDE_SANDBOX"


def test_confine_unknown_session():
    _, error = confine("nope", "/whatever")
    assert error is not None
    assert error.code == "SESSION_NOT_FOUND"


# --- write-time guard (Stage 1) --------------------------------------------


def test_guard_rejects_symlinked_target(tmp_path):
    sandbox = tmp_path / "sb"
    sandbox.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    link = sandbox / "link"
    link.symlink_to(outside)

    ctx = ExecutionContext()
    ctx.sandbox_root = str(sandbox)
    assert guard_target(ctx, str(link)) is not None


def test_guard_rejects_target_outside_sandbox(tmp_path):
    sandbox = tmp_path / "sb"
    sandbox.mkdir()
    ctx = ExecutionContext()
    ctx.sandbox_root = str(sandbox)
    assert guard_target(ctx, str(tmp_path / "elsewhere")) is not None


def test_guard_allows_target_inside_sandbox(tmp_path):
    sandbox = tmp_path / "sb"
    sandbox.mkdir()
    ctx = ExecutionContext()
    ctx.sandbox_root = str(sandbox)
    assert guard_target(ctx, str(sandbox / "new_folder")) is None


def test_guard_noop_without_sandbox(tmp_path):
    ctx = ExecutionContext()  # no sandbox_root → engine unit-test mode
    assert guard_target(ctx, "/etc/passwd") is None


def test_move_into_symlinked_target_is_rejected(tmp_path):
    """A symlinked destination that appeared after the scan is caught at write time."""
    sandbox = tmp_path / "sb"
    src = sandbox / "src"
    src.mkdir(parents=True)
    (src / "a.txt").write_text("x")
    outside = tmp_path / "outside"
    outside.mkdir()
    target = sandbox / "target"
    target.symlink_to(outside)  # symlink masquerading as a folder inside the sandbox

    ctx = sandbox_ctx(sandbox)
    result = execute_workflow(
        workflow([node("m", "moveFile", {"targetPath": str(target), "ifExists": "fail"})],
                 [edge("trigger-1", "m")]),
        ctx,
    )
    assert result.error is not None and "containment" in result.error.lower()
    assert (src / "a.txt").exists()  # nothing left the sandbox
    assert not (outside / "a.txt").exists()


# --- quotas (Stage 2) ------------------------------------------------------


def _file_item(path, size):
    return WorkflowItem(id=path, type="file", path=path, name=path.split("/")[-1], parent_path="/root", size=size)


def test_check_quota_flags_file_count(monkeypatch):
    monkeypatch.setattr(settings, "quota_max_files", 2)
    items = [_file_item(f"/root/f{i}.txt", 1) for i in range(3)]
    assert check_quota(items, "/root") is not None


def test_check_quota_flags_bytes(monkeypatch):
    monkeypatch.setattr(settings, "quota_max_bytes", 10)
    items = [_file_item("/root/big.bin", 50)]
    assert check_quota(items, "/root") is not None


def test_check_quota_ok_under_limits():
    items = [_file_item("/root/f.txt", 1)]
    assert check_quota(items, "/root") is None


def test_copy_fanout_aborts_real_run_on_quota(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "quota_max_files", 2)
    sandbox = tmp_path / "sb"
    sandbox.mkdir()
    (sandbox / "a.txt").write_text("x")
    for name in ("d1", "d2", "d3"):
        (sandbox / name).mkdir()

    ctx = sandbox_ctx(sandbox)
    cp = node("cp", "copyFile", {"targetPaths": [str(sandbox / "d1"), str(sandbox / "d2"), str(sandbox / "d3")],
                                 "keepOriginal": True, "ifExists": "rename_incrementally"})
    result = execute_workflow(workflow([cp], [edge("trigger-1", "cp")]), ctx)

    assert result.error is not None and "limit" in result.error.lower()
    # Rolled back: only the original file remains on disk.
    copied = [p for p in sandbox.rglob("a*.txt")]
    assert copied == [sandbox / "a.txt"]


def test_copy_fanout_warns_in_dry_run_on_quota(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "quota_max_files", 2)
    sandbox = tmp_path / "sb"
    sandbox.mkdir()
    (sandbox / "a.txt").write_text("x")
    for name in ("d1", "d2", "d3"):
        (sandbox / name).mkdir()

    ctx = sandbox_ctx(sandbox, dry_run=True)
    cp = node("cp", "copyFile", {"targetPaths": [str(sandbox / "d1"), str(sandbox / "d2"), str(sandbox / "d3")],
                                 "keepOriginal": True, "ifExists": "rename_incrementally"})
    result = execute_workflow(workflow([cp], [edge("trigger-1", "cp")]), ctx)

    assert result.error is None  # dry-run does not abort
    assert any(w.code == "QUOTA_EXCEEDED" for w in result.warnings)


# --- run lock (Stage 2) ----------------------------------------------------


def test_single_active_run_per_session():
    ctx = ExecutionContext()
    ctx.session_id = "s1"
    state = execution_store.create("e1", ctx)
    assert execution_store.has_active_session_run("s1") is True
    assert execution_store.has_active_session_run("other") is False

    execution_store.finish(state, WorkflowExecutionResult())
    assert execution_store.has_active_session_run("s1") is False


# --- IDOR: ownership checks on by-id endpoints (M1) -------------------------


def test_execution_status_requires_owning_session(client):
    ctx = ExecutionContext()
    ctx.session_id = "owner-sess"
    execution_store.create("exec-own", ctx)

    assert client.get("/workflows/api/execute/exec-own").status_code == 404
    assert client.get("/workflows/api/execute/exec-own", headers={"X-Session-Id": "intruder"}).status_code == 404
    owned = client.get("/workflows/api/execute/exec-own", headers={"X-Session-Id": "owner-sess"})
    assert owned.status_code == 200


def test_explore_job_requires_owning_session(client):
    from app.modules.folder_explorer.application import job_store

    job_store.create_job("job-own", "owner-sess")

    assert client.get("/folder_explorer/api/explore/job-own").status_code == 404
    assert client.get("/folder_explorer/api/explore/job-own", headers={"X-Session-Id": "intruder"}).status_code == 404
    owned = client.get("/folder_explorer/api/explore/job-own", headers={"X-Session-Id": "owner-sess"})
    assert owned.status_code == 200
    assert "session_id" not in owned.json()  # owner field never serialized to the client


# --- shared secret middleware (H2) -----------------------------------------


def test_internal_secret_enforced_when_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "internal_api_secret", "topsecret")

    assert client.get("/workflows/api/health").status_code == 200  # exempt: docker healthcheck
    assert client.get("/workflows/api/runs?session_id=x").status_code == 401  # no header → blocked
    passed = client.get("/workflows/api/runs?session_id=x", headers={"X-Internal-Secret": "topsecret"})
    assert passed.status_code != 401  # header accepted; handler then runs (404 unknown session)


# --- node-count limit via the API (Stage 2) --------------------------------


def test_execute_rejects_too_many_nodes(client, tmp_path, make_session, monkeypatch):
    monkeypatch.setattr(settings, "max_workflow_nodes", 1)
    sandbox = tmp_path / "sb"
    sandbox.mkdir()
    session = make_session(sandbox)

    def cf(node_id):
        return {"id": node_id, "type": "createFolder", "category": "general", "name": node_id, "version": 1,
                "config": {"folderName": node_id, "parentFolderPath": str(sandbox), "ifExists": "fail"}}

    body = {
        "workflow": {
            "nodes": [cf("a"), cf("b")],
            "edges": [{"id": "t->a", "source": "trigger-1", "target": "a", "sourceHandle": None}],
            "trigger": {"id": "trigger-1", "type": "manual_trigger", "category": "trigger", "name": "t", "version": 1, "config": {}},
        },
        "session_id": session,
        "rootPath": str(sandbox),
        "mode": "dryRun",
    }
    res = client.post("/workflows/api/execute", json=body)
    assert res.status_code == 400
    assert res.json()["code"] == "TOO_MANY_NODES"


def test_execute_rejects_unsafe_name_field(client, tmp_path, make_session):
    sandbox = tmp_path / "sb"
    sandbox.mkdir()
    session = make_session(sandbox)

    body = {
        "workflow": {
            "nodes": [{
                "id": "cf", "type": "createFolder", "category": "general", "name": "cf", "version": 1,
                "config": {"folderName": "../../etc/evil", "parentFolderPath": str(sandbox), "ifExists": "fail"},
            }],
            "edges": [{"id": "t->cf", "source": "trigger-1", "target": "cf", "sourceHandle": None}],
            "trigger": {"id": "trigger-1", "type": "manual_trigger", "category": "trigger", "name": "t", "version": 1, "config": {}},
        },
        "session_id": session,
        "rootPath": str(sandbox),
        "mode": "dryRun",
    }
    res = client.post("/workflows/api/execute", json=body)
    assert res.status_code == 400
    assert res.json()["code"] == "PATH_OUTSIDE_SANDBOX"


# --- cleanup (Stage 2) -----------------------------------------------------


def test_cleanup_removes_expired_sandbox(monkeypatch):
    monkeypatch.setattr(settings, "session_ttl_seconds", 0)
    session = session_service.create_session()
    assert session_service.get_session(session.id) is not None
    from pathlib import Path
    assert Path(session.sandbox_path).exists()

    time.sleep(0.01)
    reclaimed = cleanup.cleanup_once()

    assert reclaimed >= 1
    assert session_service.get_session(session.id) is None
    assert not Path(session.sandbox_path).exists()


def test_cleanup_enforces_global_cap(monkeypatch):
    monkeypatch.setattr(settings, "session_ttl_seconds", 10_000)  # nothing expires by age
    first = session_service.create_session()
    time.sleep(0.01)
    second = session_service.create_session()

    monkeypatch.setattr(settings, "max_sessions", 1)  # tighten the cap once both exist
    cleanup.cleanup_once()

    # Oldest beyond the cap is reclaimed; the most recent survives.
    assert session_service.get_session(first.id) is None
    assert session_service.get_session(second.id) is not None


def test_create_session_rejects_at_capacity(monkeypatch):
    monkeypatch.setattr(settings, "max_sessions", 1)
    session_service.create_session()

    import pytest

    with pytest.raises(session_service.SandboxCapacityError):
        session_service.create_session()


def test_delete_session_removes_run_logs(tmp_path):
    from app.modules.workflows.application import run_store

    session = session_service.create_session()
    log = tmp_path / "execution-del.log"
    log.write_text("body", encoding="utf-8")
    run_store.record_start("del", session.id, str(log))

    session_service.delete_session(session.id)

    assert not log.exists()  # the referenced log file is reclaimed, not just the DB row
    assert session_service.get_session(session.id) is None
