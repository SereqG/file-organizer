from datetime import datetime, timedelta

import pytest

from app.modules.workflows.application.conditions.evaluate import MissingFieldError, evaluate
from app.modules.workflows.application.conditions.operators import apply_operator
from app.modules.workflows.application.conditions.partition import partition_if, partition_switch
from app.modules.workflows.domain.models import WorkflowItem


def make_item(**kwargs) -> WorkflowItem:
    defaults = dict(id="1", type="file", path="/x/a.txt", name="a.txt", parent_path="/x", extension=".txt")
    defaults.update(kwargs)
    return WorkflowItem(**defaults)


def condition(field, operator, value, **extra):
    return {"field": field, "operator": operator, "value": value, **extra}


def group(*children, operator="AND", **extra):
    return {"operator": operator, "children": list(children), **extra}


# --- operators -----------------------------------------------------------------

def test_string_operators_case_insensitive():
    assert apply_operator("contains", "Invoice.PDF", "pdf", case_sensitive=False) is True
    assert apply_operator("contains", "Invoice.PDF", "pdf", case_sensitive=True) is False
    assert apply_operator("starts_with", "report", "rep", case_sensitive=True) is True
    assert apply_operator("ends_with", "report", "ort", case_sensitive=True) is True


def test_equals_is_type_strict_like_javascript():
    assert apply_operator("equals", 1, 1, case_sensitive=True) is True
    # bool and number never match, mirroring `true === 1`
    assert apply_operator("equals", True, 1, case_sensitive=True) is False
    assert apply_operator("equals", True, True, case_sensitive=True) is True


def test_number_comparisons_reject_booleans():
    assert apply_operator("greater_than", 10, 5, case_sensitive=True) is True
    assert apply_operator("less_or_equal", 5, 5, case_sensitive=True) is True
    assert apply_operator("greater_than", True, 0, case_sensitive=True) is False


def test_between_numbers_and_dates():
    assert apply_operator("between", 5, [1, 10], case_sensitive=True) is True
    assert apply_operator("between", 50, [1, 10], case_sensitive=True) is False
    now = datetime.now()
    actual = now.isoformat()
    low = (now - timedelta(days=1)).isoformat()
    high = (now + timedelta(days=1)).isoformat()
    assert apply_operator("between", actual, [low, high], case_sensitive=True) is True


def test_date_compare_and_within_last():
    now = datetime.now()
    recent = (now - timedelta(hours=1)).isoformat()
    old = (now - timedelta(days=30)).isoformat()
    assert apply_operator("before", old, recent, case_sensitive=True) is True
    assert apply_operator("after", recent, old, case_sensitive=True) is True
    assert apply_operator("within_last", recent, {"amount": 1, "unit": "days"}, case_sensitive=True) is True
    assert apply_operator("within_last", old, {"amount": 1, "unit": "days"}, case_sensitive=True) is False


def test_malformed_operands_never_raise():
    assert apply_operator("between", 5, [1], case_sensitive=True) is False
    assert apply_operator("greater_than", "abc", 5, case_sensitive=True) is False
    assert apply_operator("before", "not-a-date", "also-bad", case_sensitive=True) is False
    assert apply_operator("within_last", "x", {"amount": 1, "unit": "eons"}, case_sensitive=True) is False


# --- evaluate ------------------------------------------------------------------

def test_and_group_short_circuits_to_false():
    g = group(
        condition("extension", "equals", ".txt"),
        condition("name", "starts_with", "z"),
    )
    assert evaluate(make_item(), g) is False


def test_or_group_matches_on_any_child():
    g = group(
        condition("name", "starts_with", "z"),
        condition("extension", "equals", ".txt"),
        operator="OR",
    )
    assert evaluate(make_item(), g) is True


def test_negate_on_condition_and_group():
    assert evaluate(make_item(), group(condition("extension", "equals", ".txt", negate=True))) is False
    g = group(condition("extension", "equals", ".txt"), negate=True)
    assert evaluate(make_item(), g) is False


def test_type_directory_is_exposed_as_folder():
    folder = make_item(type="directory", name="docs", path="/x/docs", extension=None)
    assert evaluate(folder, group(condition("type", "equals", "folder"))) is True
    assert evaluate(folder, group(condition("type", "equals", "file"))) is False


def test_missing_field_strategy_false_vs_skip_vs_error():
    # "depth" exists, but "ai.category" never resolves on the backend.
    g = group(condition("ai.category", "equals", "invoice"))
    assert evaluate(make_item(), g, "false") is False
    # With negate + "false", a missing field flips to true.
    g_negate = group(condition("ai.category", "equals", "invoice", negate=True))
    assert evaluate(make_item(), g_negate, "false") is True
    # "skip" forces the condition false regardless of negate.
    assert evaluate(make_item(), g_negate, "skip") is False
    with pytest.raises(MissingFieldError):
        evaluate(make_item(), g, "error")


# --- partition -----------------------------------------------------------------

def test_partition_if_routes_every_item_to_one_branch():
    items = [
        make_item(id="a", name="a.txt", extension=".txt"),
        make_item(id="b", name="b.log", extension=".log"),
    ]
    config = {"conditions": group(condition("extension", "equals", ".txt"))}
    branches = partition_if(items, config)
    assert branches == {"true": ["a"], "false": ["b"]}


def test_partition_if_propagates_error_strategy():
    items = [make_item(id="a")]
    config = {
        "conditions": group(condition("ai.x", "equals", "y")),
        "missingFieldStrategy": "error",
    }
    with pytest.raises(MissingFieldError):
        partition_if(items, config)


def switch_case(case_id, *children):
    return {"id": case_id, "conditions": group(*children)}


def test_partition_switch_fans_out_to_every_matching_case():
    items = [
        make_item(id="a", name="a.txt", extension=".txt"),
        make_item(id="b", name="b.log", extension=".log"),
    ]
    config = {
        "cases": [
            switch_case("c1", condition("extension", "equals", ".txt")),
            switch_case("c2", condition("name", "contains", "a")),
        ]
    }
    branches = partition_switch(items, config)
    # "a.txt" matches both cases (extension .txt and name contains "a") -> appears in both.
    assert branches == {"c1": ["a"], "c2": ["a"], "default": ["b"]}


def test_partition_switch_routes_unmatched_to_default():
    items = [make_item(id="a", name="a.txt", extension=".txt")]
    config = {"cases": [switch_case("c1", condition("extension", "equals", ".pdf"))]}
    branches = partition_switch(items, config)
    assert branches == {"c1": [], "default": ["a"]}


def test_partition_switch_propagates_error_strategy():
    items = [make_item(id="a")]
    config = {
        "cases": [switch_case("c1", condition("ai.x", "equals", "y"))],
        "missingFieldStrategy": "error",
    }
    with pytest.raises(MissingFieldError):
        partition_switch(items, config)
