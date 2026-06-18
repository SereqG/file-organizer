"""Workstream 3 — AI classification is served from an in-memory, content-fingerprinted cache.

The model (``_classify_batch``) is mocked to count passes and record what it is asked to score, so
the tests assert exactly when the cache hits, when it re-classifies, and that thresholds/duplicate
settings reuse cached scores.
"""

from datetime import datetime

import pytest

from app.modules.ai.application import classification_cache, classifier
from app.modules.ai.domain.models import Category, ClassificationScore
from app.modules.workflows.domain.models import WorkflowItem

_CONST_CONFIDENCE = 0.7  # every (item, category) pair scores the same so buckets are predictable


@pytest.fixture(autouse=True)
def fresh_cache():
    classification_cache.clear()
    yield
    classification_cache.clear()


@pytest.fixture
def calls(monkeypatch):
    recorded: list[tuple[list[str], list[str]]] = []

    def fake_classify_batch(client, batch, categories):
        recorded.append(([i.id for i in batch], [c.id for c in categories]))
        scores = [
            ClassificationScore(item.id, cat.id, _CONST_CONFIDENCE)
            for item in batch
            for cat in categories
        ]
        return None, scores

    monkeypatch.setattr(classifier, "_classify_batch", fake_classify_batch)
    monkeypatch.setattr(classifier, "get_client", lambda: object())
    return recorded


def item(item_id, name):
    return WorkflowItem(
        id=item_id, type="file", path=f"/root/{name}", name=name, parent_path="/root",
        extension=".txt", size=10, modified_at=datetime(2024, 1, 1),
    )


def category(cat_id, name, description="d", min_confidence="medium"):
    return Category(id=cat_id, name=name, description=description, item_type="both",
                    extensions=[], min_confidence=min_confidence)


def items_3():
    return [item("i1", "a.txt"), item("i2", "b.txt"), item("i3", "c.txt")]


def cats_2():
    return [category("c1", "First"), category("c2", "Second")]


def test_second_identical_classify_makes_no_model_call(calls):
    err1, buckets1 = classifier.classify_items(items_3(), cats_2(), allow_duplicate=False)
    assert err1 is None
    assert len(calls) == 1  # one batch (3 items <= batch size)

    err2, buckets2 = classifier.classify_items(items_3(), cats_2(), allow_duplicate=False)
    assert err2 is None
    assert len(calls) == 1  # served entirely from cache
    assert buckets1 == buckets2


def test_changed_item_modified_at_resends_only_that_item(calls):
    classifier.classify_items(items_3(), cats_2(), allow_duplicate=False)
    assert len(calls) == 1

    changed = items_3()
    changed[0].modified_at = datetime(2025, 6, 1)  # edited file
    classifier.classify_items(changed, cats_2(), allow_duplicate=False)

    assert len(calls) == 2
    sent_item_ids, _ = calls[1]
    assert sent_item_ids == ["i1"]


def test_changed_category_description_resends_all_items_for_that_category(calls):
    classifier.classify_items(items_3(), cats_2(), allow_duplicate=False)
    assert len(calls) == 1

    cats = cats_2()
    cats[0].description = "a different description"
    classifier.classify_items(items_3(), cats, allow_duplicate=False)

    assert len(calls) == 2
    sent_item_ids, sent_cat_ids = calls[1]
    assert set(sent_item_ids) == {"i1", "i2", "i3"}
    assert sent_cat_ids == ["c1"]  # only the changed category is re-scored


def test_allow_duplicate_change_reuses_scores(calls):
    _, single = classifier.classify_items(items_3(), cats_2(), allow_duplicate=False)
    assert len(calls) == 1
    # Tie at _CONST_CONFIDENCE → first category wins when duplicates are off.
    assert single["c1"] == ["i1", "i2", "i3"] and single["c2"] == []

    _, dup = classifier.classify_items(items_3(), cats_2(), allow_duplicate=True)
    assert len(calls) == 1  # no new model passes
    assert dup["c1"] == ["i1", "i2", "i3"] and dup["c2"] == ["i1", "i2", "i3"]


def test_threshold_change_reuses_scores(calls):
    classifier.classify_items(items_3(), cats_2(), allow_duplicate=False)
    assert len(calls) == 1

    strict = [category("c1", "First", min_confidence="high"), category("c2", "Second", min_confidence="high")]
    _, buckets = classifier.classify_items(items_3(), strict, allow_duplicate=False)
    assert len(calls) == 1  # scores reused; threshold applied after scoring
    # 0.7 < 0.85 (high) → everything falls into unclassified.
    assert buckets["_unclassified"] == ["i1", "i2", "i3"]


def test_clear_empties_cache(calls):
    classifier.classify_items(items_3(), cats_2(), allow_duplicate=False)
    assert len(calls) == 1

    classification_cache.clear()
    classifier.classify_items(items_3(), cats_2(), allow_duplicate=False)
    assert len(calls) == 2  # cache was emptied, full re-classify


def test_callback_fires_once_per_item_including_cache_hits(calls):
    classifier.classify_items(items_3(), cats_2(), allow_duplicate=False)

    seen: list[str] = []
    classifier.classify_items(
        items_3(), cats_2(), allow_duplicate=False,
        on_items_classified=lambda results: seen.extend(name for name, _ in results),
    )
    assert len(calls) == 1  # all from cache
    assert sorted(seen) == ["a.txt", "b.txt", "c.txt"]  # every item still reported
