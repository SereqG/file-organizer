"""In-memory cache of raw per-(item, category) confidence scores.

Keyed on content fingerprints so re-simulating an unchanged workspace re-bills nothing, while a
changed file (new size/mtime) or a changed category description naturally misses and is re-scored.
Buckets, thresholds and the allow-duplicate flag are applied *after* scoring, so they are
deliberately NOT part of the key — changing them reuses cached scores.

In-memory and process-local by design (see the simulation plan). Lost on restart.
"""

import threading
from hashlib import sha256
from typing import Optional

from app.modules.ai.domain.models import Category
from app.modules.workflows.domain.models import WorkflowItem

# Bump to invalidate every cached score (e.g. when the classification prompt changes).
_CACHE_VERSION = 1

_UNIT = "\x1f"  # unit separator — safe field delimiter inside a fingerprint

_scores: dict[tuple[int, str, str, str], float] = {}
_lock = threading.Lock()


def _sha256(text: str) -> str:
    return sha256(text.encode("utf-8")).hexdigest()


def item_fingerprint(item: WorkflowItem) -> str:
    """Content-change proxy. Excludes path (a file reuses its score wherever it sits) but includes
    name (the model is shown the name). size + modified_at catch content edits."""
    parts = (
        item.type,
        item.name,
        item.extension or "",
        item.mime_type or "",
        str(item.size or 0),
        item.modified_at.isoformat() if item.modified_at else "",
    )
    return _sha256(_UNIT.join(parts))


def category_fingerprint(category: Category) -> str:
    # min_confidence is deliberately excluded: it is a post-scoring threshold applied in
    # _build_buckets, never shown to the model, so changing it must reuse cached raw scores.
    parts = (
        category.id,
        category.name,
        category.description,
        category.item_type,
        ",".join(sorted(category.extensions)),
    )
    return _sha256(_UNIT.join(parts))


def get(model: str, item_fp: str, cat_fp: str) -> Optional[float]:
    with _lock:
        return _scores.get((_CACHE_VERSION, model, item_fp, cat_fp))


def put(model: str, item_fp: str, cat_fp: str, confidence: float) -> None:
    with _lock:
        # TODO: cap with LRU once memory becomes a concern (unbounded by design for now).
        _scores[(_CACHE_VERSION, model, item_fp, cat_fp)] = confidence


def clear() -> None:
    with _lock:
        _scores.clear()
