"""Condition operators, mirroring the frontend evaluator (lib/workflow/evaluator/operators.ts).

Every operator is total: unusable operands evaluate to ``False`` rather than raising, so a
malformed condition can never abort a workflow run.
"""

import time
from datetime import datetime
from typing import Any, Optional

_MS_PER_UNIT = {
    "minutes": 60_000,
    "hours": 3_600_000,
    "days": 86_400_000,
    "weeks": 604_800_000,
}

_STRING_OPERATORS = frozenset({"contains", "starts_with", "ends_with"})
_NUMBER_OPERATORS = frozenset({"greater_than", "less_than", "greater_or_equal", "less_or_equal"})


def apply_operator(operator: str, actual: Any, expected: Any, case_sensitive: bool) -> bool:
    if operator == "equals":
        return _equals(actual, expected, case_sensitive)
    if operator in _STRING_OPERATORS:
        return _string_op(operator, actual, expected, case_sensitive)
    if operator in _NUMBER_OPERATORS:
        return _number_compare(operator, actual, expected)
    if operator == "between":
        return _between(actual, expected)
    if operator in ("before", "after"):
        return _date_compare(operator, actual, expected)
    if operator == "within_last":
        return _within_last(actual, expected)
    return False


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _apply_case(value: str, case_sensitive: bool) -> str:
    return value if case_sensitive else value.lower()


def _as_string(value: Any) -> Optional[str]:
    return value if isinstance(value, str) else None


def _as_number(value: Any) -> Optional[float]:
    return float(value) if _is_number(value) else None


def _as_date_ms(value: Any) -> Optional[float]:
    if isinstance(value, datetime):
        return value.timestamp() * 1000
    if _is_number(value):
        return float(value)
    if isinstance(value, str) and value:
        return _parse_iso_ms(value)
    return None


def _parse_iso_ms(value: str) -> Optional[float]:
    candidate = value.replace("Z", "+00:00") if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError:
        return None
    # Naive datetimes follow the runtime's local timezone, matching the frontend's
    # `new Date(string)` semantics for datetime-local inputs.
    return parsed.timestamp() * 1000


def _equals(actual: Any, expected: Any, case_sensitive: bool) -> bool:
    if isinstance(actual, str) and isinstance(expected, str):
        return _apply_case(actual, case_sensitive) == _apply_case(expected, case_sensitive)
    # Mirror JavaScript strict equality: differing types never match.
    if isinstance(actual, bool) or isinstance(expected, bool):
        return type(actual) is type(expected) and actual == expected
    if _is_number(actual) and _is_number(expected):
        return actual == expected
    return actual == expected


def _string_op(operator: str, actual: Any, expected: Any, case_sensitive: bool) -> bool:
    a = _as_string(actual)
    e = _as_string(expected)
    if a is None or e is None:
        return False
    a = _apply_case(a, case_sensitive)
    e = _apply_case(e, case_sensitive)
    if operator == "contains":
        return e in a
    if operator == "starts_with":
        return a.startswith(e)
    return a.endswith(e)


def _number_compare(operator: str, actual: Any, expected: Any) -> bool:
    a = _as_number(actual)
    e = _as_number(expected)
    if a is None or e is None:
        return False
    if operator == "greater_than":
        return a > e
    if operator == "less_than":
        return a < e
    if operator == "greater_or_equal":
        return a >= e
    return a <= e


def _between(actual: Any, expected: Any) -> bool:
    if not isinstance(expected, list) or len(expected) != 2:
        return False
    low, high = expected
    a_num = _as_number(actual)
    if a_num is not None:
        low_num = _as_number(low)
        high_num = _as_number(high)
        if low_num is None or high_num is None:
            return False
        return low_num <= a_num <= high_num
    a_date = _as_date_ms(actual)
    low_date = _as_date_ms(low)
    high_date = _as_date_ms(high)
    if a_date is not None and low_date is not None and high_date is not None:
        return low_date <= a_date <= high_date
    return False


def _date_compare(operator: str, actual: Any, expected: Any) -> bool:
    a = _as_date_ms(actual)
    e = _as_date_ms(expected)
    if a is None or e is None:
        return False
    return a < e if operator == "before" else a > e


def _within_last(actual: Any, expected: Any) -> bool:
    a = _as_date_ms(actual)
    if a is None:
        return False
    window = _parse_duration(expected)
    if window is None:
        return False
    now = time.time() * 1000
    return now - window <= a <= now


def _parse_duration(expected: Any) -> Optional[float]:
    if not isinstance(expected, dict):
        return None
    amount = _as_number(expected.get("amount"))
    unit = expected.get("unit")
    if amount is None or not isinstance(unit, str):
        return None
    ms = _MS_PER_UNIT.get(unit)
    return amount * ms if ms is not None else None
