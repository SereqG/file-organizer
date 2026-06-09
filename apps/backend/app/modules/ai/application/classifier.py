"""Batch classifier: sends WorkflowItems to the AI in chunks of 4 and returns
buckets keyed by category id for routing by the execution engine."""

import base64
import json
from dataclasses import dataclass
from typing import Callable, Optional

import filetype
from pypdf import PdfReader

from app.config import settings
from app.modules.ai.domain.constants import CONFIDENCE_THRESHOLDS
from app.modules.ai.domain.models import Category, ClassificationScore
from app.modules.ai.infrastructure.openrouter_client import get_client
from app.modules.workflows.domain.models import WorkflowItem
from app.shared.logger import get_logger

_logger = get_logger("ai")

_BATCH_SIZE = 4
_UNCLASSIFIED_KEY = "_unclassified"

_SYSTEM_PROMPT = (
    "You are a file classification assistant. "
    "Given a list of files or folders and a set of categories with descriptions, "
    "return a confidence score (0.0 to 1.0) for every item-category pair. "
    "1.0 = definite match, 0.0 = definite non-match. "
    "When a file's content_preview is provided, use it as the primary signal for classification. "
    "For image files, the image is attached directly after the item metadata — inspect it visually. "
    "Fall back to name, extension, and MIME type when content is unavailable. "
    "Return ONLY valid JSON matching the provided schema, no explanation."
)

_MAX_TEXT_BYTES = 8_192
_MAX_PDF_TEXT_CHARS = 8_192
_MAX_TEXT_SIZE_BYTES = 5 * 1024 * 1024    # 5 MB
_MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
_MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024    # 20 MB

_TEXT_MIME_PREFIXES = ("text/",)
_TEXT_MIME_TYPES = frozenset({
    "application/json",
    "application/xml",
    "application/javascript",
    "application/x-python",
    "application/x-sh",
    "application/x-yaml",
    "application/toml",
    "application/xhtml+xml",
    "application/ld+json",
})
_PDF_MIME_TYPE = "application/pdf"

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


@dataclass
class _FormattedItem:
    meta_text: str
    image_b64: Optional[str] = None
    image_mime: Optional[str] = None


def classify_items(
    items: list[WorkflowItem],
    categories: list[Category],
    allow_duplicate: bool,
    on_items_classified: Optional[Callable[[list[tuple[str, Optional[str]]]], None]] = None,
) -> tuple[Optional[str], Optional[dict[str, list[str]]]]:
    """Classify items against categories. Returns (error, result_buckets) where
    result_buckets maps category id → list of item ids, plus an ``_unclassified`` key.

    ``on_items_classified`` is called after each LLM batch with a list of
    ``(item_name, category_names_or_None)`` so callers can stream progress in real time.
    """
    _logger.info(
        "Classifier started | items=%d categories=%d allow_duplicate=%s",
        len(items), len(categories), allow_duplicate,
    )
    for item in items:
        _logger.debug("  Input item: id=%s name=%s type=%s ext=%s", item.id, item.name, item.type, item.extension)
    for cat in categories:
        _logger.debug("  Category: id=%s name=%s item_type=%s min_confidence=%s", cat.id, cat.name, cat.item_type, cat.min_confidence)

    if not categories:
        _logger.warning("Classifier aborted: no categories configured")
        return "No categories configured.", None

    category_by_id = {c.id: c for c in categories}

    candidates: dict[str, set[str]] = {item.id: set() for item in items}
    for category in categories:
        for item in items:
            if _passes_prefilter(item, category):
                candidates[item.id].add(category.id)

    items_without_candidates = [item for item in items if not candidates[item.id]]
    items_to_classify = [item for item in items if candidates[item.id]]

    _logger.info(
        "Pre-filter complete | to_classify=%d skipped=%d",
        len(items_to_classify), len(items_without_candidates),
    )
    for item in items_without_candidates:
        _logger.debug("  Pre-filter skipped (no matching category): id=%s name=%s", item.id, item.name)

    if on_items_classified and items_without_candidates:
        on_items_classified([(item.name, None) for item in items_without_candidates])

    all_scores: list[ClassificationScore] = []
    client = get_client()

    for i in range(0, len(items_to_classify), _BATCH_SIZE):
        batch = items_to_classify[i : i + _BATCH_SIZE]
        relevant_cat_ids: set[str] = set()
        for item in batch:
            relevant_cat_ids |= candidates[item.id]
        relevant_cats = [category_by_id[cid] for cid in relevant_cat_ids]

        batch_names = [item.name for item in batch]
        cat_names = [c.name for c in relevant_cats]
        _logger.info(
            "Batch %d/%d | items=%s | categories=%s",
            i // _BATCH_SIZE + 1, -(-len(items_to_classify) // _BATCH_SIZE), batch_names, cat_names,
        )

        error, scores = _classify_batch(client, batch, relevant_cats)
        if error:
            _logger.error("Batch %d failed: %s", i // _BATCH_SIZE + 1, error)
            return error, None

        for score in scores:
            _logger.debug("  Score: item_id=%s category_id=%s confidence=%.3f", score.item_id, score.category_id, score.confidence)

        if on_items_classified:
            on_items_classified(_resolve_batch_results(batch, scores, relevant_cats, candidates, categories, allow_duplicate))

        all_scores.extend(scores)

    score_map: dict[tuple[str, str], float] = {}
    for score in all_scores:
        score_map[(score.item_id, score.category_id)] = score.confidence

    buckets = _build_buckets(items_to_classify, categories, score_map, candidates, allow_duplicate)
    for item in items_without_candidates:
        buckets[_UNCLASSIFIED_KEY].append(item.id)

    _logger.info("Classification complete | results:")
    for cat_id, item_ids in buckets.items():
        if item_ids:
            label = cat_id if cat_id != _UNCLASSIFIED_KEY else "_unclassified"
            _logger.info("  [%s] -> %s", label, item_ids)

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


def _is_text_mime_type(mime_type: Optional[str]) -> bool:
    if not mime_type:
        return False
    return mime_type.startswith(_TEXT_MIME_PREFIXES) or mime_type in _TEXT_MIME_TYPES


def _verify_image_magic(path: str) -> bool:
    try:
        kind = filetype.guess(path)
        return kind is not None and kind.mime.startswith("image/")
    except OSError:
        return False


def _verify_pdf_magic(path: str) -> bool:
    try:
        with open(path, "rb") as f:
            return f.read(5) == b"%PDF-"
    except OSError:
        return False


def _read_file_content(path: str) -> tuple[Optional[str], Optional[str]]:
    """Returns (content, skip_reason)."""
    try:
        with open(path, "r", encoding="utf-8", errors="strict") as f:
            return f.read(_MAX_TEXT_BYTES), None
    except UnicodeDecodeError:
        return None, "binary content"
    except OSError as exc:
        return None, f"read error: {exc}"


def _read_pdf_text(path: str) -> tuple[Optional[str], Optional[str]]:
    """Returns (extracted_text, skip_reason)."""
    try:
        reader = PdfReader(path)
        parts: list[str] = []
        total = 0
        for page in reader.pages:
            chunk = page.extract_text() or ""
            parts.append(chunk)
            total += len(chunk)
            if total >= _MAX_PDF_TEXT_CHARS:
                break
        return "".join(parts)[:_MAX_PDF_TEXT_CHARS], None
    except Exception as exc:
        return None, f"pdf read error: {exc}"


def _read_image_b64(path: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Returns (base64_data, actual_mime, skip_reason)."""
    try:
        with open(path, "rb") as f:
            data = f.read()
        kind = filetype.guess(data)
        return base64.b64encode(data).decode("ascii"), kind.mime if kind else None, None
    except OSError as exc:
        return None, None, f"read error: {exc}"


def _format_item(item: WorkflowItem) -> _FormattedItem:
    meta = (
        f'- id="{item.id}" name="{item.name}" type={item.type}'
        f' extension={item.extension or "none"}'
        f' mime={item.mime_type or "unknown"}'
        f' size={item.size or 0}'
    )
    if item.type != "file" or not item.is_readable:
        if item.type == "file" and not item.is_readable:
            _logger.debug("  Content skipped (not readable): id=%s name=%s", item.id, item.name)
        return _FormattedItem(meta_text=meta)

    mime = item.mime_type

    if mime and mime.startswith("image/"):
        if item.size is not None and item.size > _MAX_IMAGE_SIZE_BYTES:
            _logger.debug("  Image skipped (too large: %d bytes): id=%s", item.size, item.id)
            return _FormattedItem(meta_text=meta)
        if not _verify_image_magic(item.path):
            _logger.warning("  Image skipped (magic bytes mismatch): id=%s name=%s", item.id, item.name)
            return _FormattedItem(meta_text=meta)
        b64, actual_mime, err = _read_image_b64(item.path)
        if err:
            _logger.debug("  Image skipped (%s): id=%s", err, item.id)
            return _FormattedItem(meta_text=meta)
        _logger.debug("  Image loaded: id=%s mime=%s", item.id, actual_mime)
        return _FormattedItem(meta_text=meta, image_b64=b64, image_mime=actual_mime or mime)

    if mime == _PDF_MIME_TYPE:
        if item.size is not None and item.size > _MAX_PDF_SIZE_BYTES:
            _logger.debug("  PDF skipped (too large: %d bytes): id=%s", item.size, item.id)
            return _FormattedItem(meta_text=meta)
        if not _verify_pdf_magic(item.path):
            _logger.warning("  PDF skipped (magic bytes mismatch): id=%s name=%s", item.id, item.name)
            return _FormattedItem(meta_text=meta)
        text, err = _read_pdf_text(item.path)
        if err:
            _logger.debug("  PDF skipped (%s): id=%s", err, item.id)
            return _FormattedItem(meta_text=meta)
        if text:
            return _FormattedItem(meta_text=meta + f'\n  content_preview: """{text}"""')
        return _FormattedItem(meta_text=meta)

    if _is_text_mime_type(mime):
        if item.size is not None and item.size > _MAX_TEXT_SIZE_BYTES:
            _logger.debug("  Content skipped (file too large: %d bytes): id=%s", item.size, item.id)
            return _FormattedItem(meta_text=meta)
        content, err = _read_file_content(item.path)
        if err:
            _logger.debug("  Content skipped (%s): id=%s", err, item.id)
            return _FormattedItem(meta_text=meta)
        if content:
            return _FormattedItem(meta_text=meta + f'\n  content_preview: """{content}"""')
        return _FormattedItem(meta_text=meta)

    _logger.debug("  Content skipped (unsupported type: %s): id=%s name=%s", mime, item.id, item.name)
    return _FormattedItem(meta_text=meta)


def _classify_batch(
    client,
    batch: list[WorkflowItem],
    categories: list[Category],
) -> tuple[Optional[str], list[ClassificationScore]]:
    formatted = [_format_item(item) for item in batch]
    categories_text = "\n".join(
        f'- id="{cat.id}" name="{cat.name}": {cat.description}'
        for cat in categories
    )
    prompt_suffix = f"\n\nCategories:\n{categories_text}\n\nReturn confidence scores for every item-category pair."

    has_images = any(f.image_b64 for f in formatted)

    if has_images:
        # Interleave each item's metadata with its image so the model can associate them.
        content: list = [{"type": "text", "text": "Items:"}]
        for fmt in formatted:
            content.append({"type": "text", "text": fmt.meta_text})
            if fmt.image_b64:
                content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:{fmt.image_mime};base64,{fmt.image_b64}"},
                })
        content.append({"type": "text", "text": prompt_suffix})
        user_content = content
    else:
        items_text = "\n".join(f.meta_text for f in formatted)
        user_content = f"Items:\n{items_text}{prompt_suffix}"

    try:
        response = client.chat.completions.create(
            model=settings.openrouter_model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "classification_scores",
                    "schema": _RESPONSE_SCHEMA,
                    "strict": True,
                },
            },
            max_tokens=4096,
        )
    except Exception as exc:
        msg = str(exc)
        if "token" in msg.lower() or "context" in msg.lower() or "length" in msg.lower():
            return "Classification failed: token limit reached. Changes will be rolled back.", []
        return f"AI classification failed: {msg}", []

    choice = response.choices[0]
    if choice.finish_reason == "length":
        return "Classification failed: AI response was cut off (output too long). Try fewer categories or a smaller batch.", []

    response_text = choice.message.content or ""
    try:
        data = json.loads(response_text)
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


def _resolve_batch_results(
    batch: list[WorkflowItem],
    scores: list[ClassificationScore],
    relevant_cats: list[Category],
    candidates: dict[str, set[str]],
    all_categories: list[Category],
    allow_duplicate: bool,
) -> list[tuple[str, Optional[str]]]:
    """Return ``(item_name, category_names | None)`` for each item in the batch.
    Used by the ``on_items_classified`` callback to stream results as each LLM batch finishes."""
    results: list[tuple[str, Optional[str]]] = []
    for item in batch:
        matches: list[tuple[Category, float]] = []
        for cat in relevant_cats:
            if cat.id not in candidates.get(item.id, set()):
                continue
            confidence = next(
                (s.confidence for s in scores if s.item_id == item.id and s.category_id == cat.id),
                0.0,
            )
            threshold = CONFIDENCE_THRESHOLDS.get(cat.min_confidence, 0.65)
            if confidence >= threshold:
                matches.append((cat, confidence))

        if not matches:
            results.append((item.name, None))
        elif allow_duplicate:
            results.append((item.name, ", ".join(m[0].name for m in matches)))
        else:
            best = max(matches, key=lambda p: (p[1], -all_categories.index(p[0])))
            results.append((item.name, best[0].name))
    return results


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
            # Tie-break by category order (already preserved in `categories`)
            best_cat = max(matches, key=lambda pair: (pair[1], -categories.index(pair[0])))[0]
            buckets[best_cat.id].append(item.id)

    return buckets
