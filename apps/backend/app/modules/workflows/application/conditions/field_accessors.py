"""Resolve a condition ``field`` to a value on a WorkflowItem.

Fields are resolved through an explicit map (never dynamic attribute access) so a condition
can only read whitelisted item data. Mirrors the frontend accessor
(lib/workflow/evaluator/fieldAccessors.ts), with two deliberate differences:

* backend item type ``directory`` is exposed as ``folder`` to match the frontend vocabulary,
* ``ai.*`` fields are never present yet (no AI execution stage), so they report "not found"
  and fall through to the node's missing-field strategy.
"""

from typing import Any

from app.modules.workflows.domain.models import WorkflowItem

AI_FIELD_PREFIX = "ai."

# Sentinel distinguishing "field resolved to None" from "field absent".
_NOT_FOUND = object()


def get_field_value(item: WorkflowItem, field: str) -> Any:
    """Return the field value, or ``_NOT_FOUND`` when the field is absent."""
    if field.startswith(AI_FIELD_PREFIX):
        return _NOT_FOUND

    resolver = _RESOLVERS.get(field)
    if resolver is None:
        return _NOT_FOUND
    return resolver(item)


def is_found(value: Any) -> bool:
    return value is not _NOT_FOUND


def _resolve_type(item: WorkflowItem) -> Any:
    return "folder" if item.type == "directory" else "file"


def _resolve_extension(item: WorkflowItem) -> Any:
    return _NOT_FOUND if item.extension is None else item.extension


def _resolve_mime_type(item: WorkflowItem) -> Any:
    return _NOT_FOUND if item.mime_type is None else item.mime_type


def _resolve_is_empty(item: WorkflowItem) -> Any:
    return item.is_empty if item.type == "directory" else _NOT_FOUND


_RESOLVERS = {
    "type": _resolve_type,
    "name": lambda item: item.name,
    "extension": _resolve_extension,
    "mime_type": _resolve_mime_type,
    "path": lambda item: item.path,
    "size": lambda item: item.size if item.size is not None else 0,
    "created_at": lambda item: item.created_at,
    "modified_at": lambda item: item.modified_at,
    "accessed_at": lambda item: item.accessed_at,
    "is_hidden": lambda item: item.is_hidden,
    "is_executable": lambda item: item.is_executable,
    "is_readable": lambda item: item.is_readable,
    "is_writable": lambda item: item.is_writable,
    "is_empty": _resolve_is_empty,
    "children_count": lambda item: item.children_count,
    "depth": lambda item: item.depth,
}
