"""Evaluate a condition group against a WorkflowItem.

Mirrors the frontend evaluator (lib/workflow/evaluator/evaluate.ts) so the in-editor
"Evaluation preview" matches real workflow runs. Conditions are consumed as raw JSON dicts
(the shape persisted by the if-node config), not domain objects.
"""

from typing import Any

from app.modules.workflows.application.conditions.field_accessors import get_field_value, is_found
from app.modules.workflows.application.conditions.operators import apply_operator
from app.modules.workflows.domain.models import WorkflowItem

# Missing-field strategies (see frontend MissingFieldStrategy).
STRATEGY_FALSE = "false"
STRATEGY_ERROR = "error"
STRATEGY_SKIP = "skip"


class MissingFieldError(Exception):
    def __init__(self, field: str) -> None:
        super().__init__(f"Missing field: {field}")
        self.field = field


def evaluate(item: WorkflowItem, group: dict, strategy: str = STRATEGY_FALSE) -> bool:
    return _evaluate_group(item, group, strategy)


def _is_group(node: dict) -> bool:
    return "children" in node


def _evaluate_group(item: WorkflowItem, group: dict, strategy: str) -> bool:
    is_and = group.get("operator") == "AND"
    result = is_and

    for child in group.get("children", []):
        child_result = (
            _evaluate_group(item, child, strategy)
            if _is_group(child)
            else _evaluate_condition(item, child, strategy)
        )
        if is_and:
            if not child_result:
                result = False
                break
        else:
            if child_result:
                result = True
                break
            result = False

    return not result if group.get("negate") else result


def _evaluate_condition(item: WorkflowItem, condition: dict, strategy: str) -> bool:
    negate = bool(condition.get("negate"))
    value = get_field_value(item, condition.get("field", ""))

    if not is_found(value):
        if strategy == STRATEGY_ERROR:
            raise MissingFieldError(condition.get("field", ""))
        if strategy == STRATEGY_SKIP:
            return False
        return True if negate else False

    options = condition.get("options") or {}
    case_sensitive = options.get("caseSensitive", True)
    matched = apply_operator(condition.get("operator", ""), value, condition.get("value"), case_sensitive)
    return not matched if negate else matched


def resolve_strategy(value: Any) -> str:
    return value if value in (STRATEGY_FALSE, STRATEGY_ERROR, STRATEGY_SKIP) else STRATEGY_FALSE
