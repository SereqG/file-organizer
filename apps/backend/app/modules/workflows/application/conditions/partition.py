"""Partition items into named branches by evaluating a routing node's condition.

The output shape — ``{branch_label: [item_id]}`` — is intentionally node-agnostic so the same
scoped-execution mechanism serves the if-node (labels ``true``/``false``) and a future switch
node (labels = case values). Only the per-item labelling differs between node types.
"""

from app.modules.workflows.application.conditions.evaluate import (
    MissingFieldError,
    evaluate,
    resolve_strategy,
)
from app.modules.workflows.domain.models import WorkflowItem

BRANCH_TRUE = "true"
BRANCH_FALSE = "false"
BRANCH_DEFAULT = "default"


def partition_if(items: list[WorkflowItem], config: dict) -> dict[str, list[str]]:
    """Route each item to the ``true`` or ``false`` branch by item id.

    Every item lands in exactly one branch, matching the frontend router. Raises
    ``MissingFieldError`` when the configured strategy is ``error`` and a field is absent.
    """
    conditions = config.get("conditions") or {}
    strategy = resolve_strategy(config.get("missingFieldStrategy"))

    branches: dict[str, list[str]] = {BRANCH_TRUE: [], BRANCH_FALSE: []}
    for item in items:
        branch = BRANCH_TRUE if evaluate(item, conditions, strategy) else BRANCH_FALSE
        branches[branch].append(item.id)
    return branches


def partition_switch(items: list[WorkflowItem], config: dict) -> dict[str, list[str]]:
    """Route each item to every matching case branch (keyed by case id).

    Fan-out: an item appears in the branch of *each* case whose condition matches. Items that
    match no case fall to the ``default`` branch. Branch labels mirror the frontend switch
    node's output handle ids (case ids, plus ``default``). Raises ``MissingFieldError`` when the
    configured strategy is ``error`` and a field is absent.
    """
    cases = config.get("cases") or []
    strategy = resolve_strategy(config.get("missingFieldStrategy"))

    branches: dict[str, list[str]] = {case["id"]: [] for case in cases}
    branches[BRANCH_DEFAULT] = []
    for item in items:
        matched = False
        for case in cases:
            if evaluate(item, case.get("conditions") or {}, strategy):
                branches[case["id"]].append(item.id)
                matched = True
        if not matched:
            branches[BRANCH_DEFAULT].append(item.id)
    return branches


__all__ = [
    "partition_if",
    "partition_switch",
    "BRANCH_TRUE",
    "BRANCH_FALSE",
    "BRANCH_DEFAULT",
    "MissingFieldError",
]
