"""In-memory cache of raw per-(item, category) confidence scores.

Keyed on content fingerprints so re-simulating an unchanged workspace re-bills nothing, while a
changed file (new size/mtime) or a changed category description naturally misses and is re-scored.
Buckets, thresholds and the allow-duplicate flag are applied *after* scoring, so they are
deliberately NOT part of the key — changing them reuses cached scores.

In-memory and process-local by design (see the simulation plan). Lost on restart.
"""

import threading
from collections import OrderedDict
from hashlib import sha256
from typing import Optional

from app.config import settings
from app.modules.ai.domain.models import Category
from app.modules.workflows.domain.models import WorkflowItem

# Bump to invalidate every cached score (e.g. when the classification prompt changes).
_CACHE_VERSION = 1

_UNIT = "\x1f"  # unit separator — safe field delimiter inside a fingerprint

# LRU bounded by settings.classification_cache_max_entries so an attacker varying file names/sizes
# and category descriptions cannot grow it without bound (it is process-global across sessions).
_scores: "OrderedDict[tuple[int, str, str, str], float]" = OrderedDict()
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
    key = (_CACHE_VERSION, model, item_fp, cat_fp)
    with _lock:
        if key not in _scores:
            return None
        _scores.move_to_end(key)  # mark most-recently used
        return _scores[key]


def put(model: str, item_fp: str, cat_fp: str, confidence: float) -> None:
    key = (_CACHE_VERSION, model, item_fp, cat_fp)
    with _lock:
        _scores[key] = confidence
        _scores.move_to_end(key)
        while len(_scores) > settings.classification_cache_max_entries:
            _scores.popitem(last=False)  # evict least-recently used


def clear() -> None:
    with _lock:
        _scores.clear()
