"""Workstream 4 — the preview/run consistency guard.

Unit tests cover the fingerprint primitives; the API tests prove the run endpoint rejects a run
without a fresh, matching preview token.
"""

from datetime import datetime

from app.modules.workflows.application.preview_token import (
    preview_token,
    workflow_hash,
    workspace_fingerprint,
)
from app.modules.workflows.domain.models import WorkflowItem


def item(path, size=10, mtime=datetime(2024, 1, 1)):
    return WorkflowItem(id=path, type="file", path=path, name=path, parent_path="/", size=size, modified_at=mtime)


def test_workspace_fingerprint_is_order_independent():
    a = [item("/a"), item("/b")]
    b = [item("/b"), item("/a")]
    assert workspace_fingerprint(a) == workspace_fingerprint(b)


def test_workspace_fingerprint_changes_on_size_or_mtime():
    base = [item("/a")]
    assert workspace_fingerprint(base) != workspace_fingerprint([item("/a", size=20)])
    assert workspace_fingerprint(base) != workspace_fingerprint([item("/a", mtime=datetime(2025, 1, 1))])


def test_workflow_hash_changes_on_config_change():
    wf1 = {"nodes": [{"id": "n", "config": {"folderName": "a"}}], "edges": [], "trigger": {}}
    wf2 = {"nodes": [{"id": "n", "config": {"folderName": "b"}}], "edges": [], "trigger": {}}
    assert workflow_hash(wf1) != workflow_hash(wf2)
    assert workflow_hash(wf1) == workflow_hash(dict(wf1))


def test_token_round_trips():
    ws = workspace_fingerprint([item("/a")])
    wf = workflow_hash({"nodes": []})
    assert preview_token(ws, wf) == preview_token(ws, wf)


# --- API-level guard -------------------------------------------------------


def _workflow(parent):
    return {
        "nodes": [{
            "id": "cf", "type": "createFolder", "category": "general", "name": "cf", "version": 1,
            "config": {"folderName": "made", "parentFolderPath": str(parent), "ifExists": "fail"},
        }],
        "edges": [{"id": "t->cf", "source": "trigger-1", "target": "cf", "sourceHandle": None}],
        "trigger": {"id": "trigger-1", "type": "manual_trigger", "category": "trigger", "name": "t", "version": 1, "config": {}},
    }


def test_preview_returns_token_and_final_tree(client, tmp_path):
    res = client.post("/workflows/api/execute", json={
        "workflow": _workflow(tmp_path), "rootPath": str(tmp_path), "mode": "dryRun",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["previewToken"]
    assert data["finalTree"] is not None
    # The predicted folder is nested under the root in the final tree.
    assert any(c["path"] == str(tmp_path / "made") for c in data["finalTree"]["children"])


def test_run_without_token_is_rejected(client, tmp_path):
    res = client.post("/workflows/api/execute", json={
        "workflow": _workflow(tmp_path), "rootPath": str(tmp_path), "mode": "run",
    })
    assert res.status_code == 409
    assert res.json()["code"] == "PREVIEW_REQUIRED"


def test_run_with_stale_token_is_rejected(client, tmp_path):
    preview = client.post("/workflows/api/execute", json={
        "workflow": _workflow(tmp_path), "rootPath": str(tmp_path), "mode": "dryRun",
    }).json()
    token = preview["previewToken"]

    (tmp_path / "intruder.txt").write_text("changed")  # workspace drifted since the preview

    res = client.post("/workflows/api/execute", json={
        "workflow": _workflow(tmp_path), "rootPath": str(tmp_path), "mode": "run", "previewToken": token,
    })
    assert res.status_code == 409
    assert res.json()["code"] == "PREVIEW_STALE"


def test_run_with_matching_token_starts(client, tmp_path):
    preview = client.post("/workflows/api/execute", json={
        "workflow": _workflow(tmp_path), "rootPath": str(tmp_path), "mode": "dryRun",
    }).json()

    res = client.post("/workflows/api/execute", json={
        "workflow": _workflow(tmp_path), "rootPath": str(tmp_path), "mode": "run",
        "previewToken": preview["previewToken"],
    })
    assert res.status_code == 202
    assert res.json()["status"] == "running"
