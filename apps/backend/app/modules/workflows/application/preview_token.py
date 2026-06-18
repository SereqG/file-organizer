"""Consistency guard between a dry-run preview and the real run.

The preview returns a token fingerprinting the scanned workspace + the as-posted workflow. The run
recomputes the token and refuses to start unless it matches — so a run always executes against the
same inputs the user reviewed (which also means the AI cache the preview populated is reused).
"""

import json
from hashlib import sha256

from app.modules.workflows.domain.models import WorkflowItem

_UNIT = "\x1f"


def _sha256(text: str) -> str:
    return sha256(text.encode("utf-8")).hexdigest()


def workspace_fingerprint(items: list[WorkflowItem]) -> str:
    """sha256 over sorted (path, size, modified_at) of every scanned item. Whole-workspace by
    design: any change forces a re-preview (the safe default; scope-narrowing is a follow-up)."""
    rows = sorted(
        _UNIT.join((
            item.path,
            str(item.size or 0),
            item.modified_at.isoformat() if item.modified_at else "",
        ))
        for item in items
    )
    return _sha256("\n".join(rows))


def workflow_hash(workflow_request_dict: dict) -> str:
    """Stable sha256 over the as-posted workflow (nodes incl. config, edges, trigger). Compute from
    the raw request BEFORE any in-run config_remap mutation."""
    canonical = json.dumps(workflow_request_dict, sort_keys=True, separators=(",", ":"))
    return _sha256(canonical)


def preview_token(ws_fp: str, wf_hash: str) -> str:
    return _sha256(ws_fp + _UNIT + wf_hash)
