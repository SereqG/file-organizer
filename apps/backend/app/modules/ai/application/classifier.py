"""Batch classifier: sends WorkflowItems to the AI in chunks of 4 and returns
buckets keyed by category id for routing by the execution engine."""

import json
from typing import Optional

from app.config import settings
from app.modules.ai.domain.constants import CONFIDENCE_THRESHOLDS
from app.modules.ai.domain.models import Category, ClassificationScore
from app.modules.ai.infrastructure.openrouter_client import get_client
from app.modules.workflows.domain.models import WorkflowItem

_BATCH_SIZE = 4
_UNCLASSIFIED_KEY = "_unclassified"

_SYSTEM_PROMPT = (
    "You are a file classification assistant. "
    "Given a list of files or folders and a set of categories with descriptions, "
    "return a confidence score (0.0 to 1.0) for every item-category pair. "
    "1.0 = definite match, 0.0 = definite non-match. "
    "Return ONLY valid JSON matching the provided schema, no explanation."
)

_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "scores": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "item_id": {"type": "string"},
                    "category_id": {"type": "string"},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": ["item_id", "category_id", "confidence"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["scores"],
    "additionalProperties": False,
}


def classify_items(
    items: list[WorkflowItem],
    categories: list[Category],
    allow_duplicate: bool,
) -> tuple[Optional[str], Optional[dict[str, list[str]]]]:
    """Classify items against categories. Returns (error, result_buckets) where
    result_buckets maps category id → list of item ids, plus an ``_unclassified`` key."""
    if not categories:
        return "No categories configured.", None

    category_by_id = {c.id: c for c in categories}

    # Pre-filter: for each item, determine which categories it is a candidate for
    candidates: dict[str, set[str]] = {item.id: set() for item in items}
    for category in categories:
        for item in items:
            if _passes_prefilter(item, category):
                candidates[item.id].add(category.id)

    items_without_candidates = [item for item in items if not candidates[item.id]]
    items_to_classify = [item for item in items if candidates[item.id]]

    # Collect all AI scores via batched calls
    all_scores: list[ClassificationScore] = []
    client = get_client()

    for i in range(0, len(items_to_classify), _BATCH_SIZE):
        batch = items_to_classify[i : i + _BATCH_SIZE]
        relevant_cat_ids: set[str] = set()
        for item in batch:
            relevant_cat_ids |= candidates[item.id]
        relevant_cats = [category_by_id[cid] for cid in relevant_cat_ids]

        error, scores = _classify_batch(client, batch, relevant_cats)
        if error:
            return error, None
        all_scores.extend(scores)

    score_map: dict[tuple[str, str], float] = {}
    for score in all_scores:
        score_map[(score.item_id, score.category_id)] = score.confidence

    buckets = _build_buckets(items_to_classify, categories, score_map, candidates, allow_duplicate)
    for item in items_without_candidates:
        buckets[_UNCLASSIFIED_KEY].append(item.id)

    return None, buckets


def _passes_prefilter(item: WorkflowItem, category: Category) -> bool:
    if category.item_type == "file" and item.type != "file":
        return False
    if category.item_type == "folder" and item.type != "directory":
        return False
    if category.extensions and item.type == "file":
        if not item.extension:
            return False
        if item.extension.lower() not in {e.lower() for e in category.extensions}:
            return False
    return True


def _classify_batch(
    client,
    batch: list[WorkflowItem],
    categories: list[Category],
) -> tuple[Optional[str], list[ClassificationScore]]:
    items_text = "\n".join(
        f'- id="{item.id}" name="{item.name}" type={item.type}'
        f' extension={item.extension or "none"}'
        f' mime={item.mime_type or "unknown"}'
        f' size={item.size or 0}'
        for item in batch
    )
    categories_text = "\n".join(
        f'- id="{cat.id}" name="{cat.name}": {cat.description}'
        for cat in categories
    )
    user_message = (
        f"Items:\n{items_text}\n\n"
        f"Categories:\n{categories_text}\n\n"
        "Return confidence scores for every item-category pair."
    )

    try:
        response = client.chat.completions.create(
            model=settings.openrouter_model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "classification_scores",
                    "schema": _RESPONSE_SCHEMA,
                    "strict": True,
                },
            },
        )
    except Exception as exc:
        msg = str(exc)
        if "token" in msg.lower() or "context" in msg.lower() or "length" in msg.lower():
            return (
                "Classification failed: token limit reached. Changes will be rolled back.",
                [],
            )
        return f"AI classification failed: {msg}", []

    content = response.choices[0].message.content or ""
    try:
        data = json.loads(content)
        scores = [
            ClassificationScore(
                item_id=s["item_id"],
                category_id=s["category_id"],
                confidence=float(s["confidence"]),
            )
            for s in data.get("scores", [])
        ]
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        return f"AI returned unexpected response format: {exc}", []

    return None, scores


def _build_buckets(
    items: list[WorkflowItem],
    categories: list[Category],
    score_map: dict[tuple[str, str], float],
    candidates: dict[str, set[str]],
    allow_duplicate: bool,
) -> dict[str, list[str]]:
    buckets: dict[str, list[str]] = {cat.id: [] for cat in categories}
    buckets[_UNCLASSIFIED_KEY] = []

    for item in items:
        item_candidates = candidates[item.id]

        matches: list[tuple[Category, float]] = []
        for cat in categories:
            if cat.id not in item_candidates:
                continue
            confidence = score_map.get((item.id, cat.id), 0.0)
            threshold = CONFIDENCE_THRESHOLDS.get(cat.min_confidence, 0.65)
            if confidence >= threshold:
                matches.append((cat, confidence))

        if not matches:
            buckets[_UNCLASSIFIED_KEY].append(item.id)
            continue

        if allow_duplicate:
            for cat, _ in matches:
                buckets[cat.id].append(item.id)
        else:
            # Single best match; tie-break by category order (already preserved in `categories`)
            best_cat = max(matches, key=lambda pair: (pair[1], -categories.index(pair[0])))[0]
            buckets[best_cat.id].append(item.id)

    return buckets
