"""In-memory store for resumable workflow executions.

A real ``mode=run`` execution runs in a background worker thread (the engine stays synchronous).
When a node needs the user to resolve a collision it calls ``context.request_decision(...)``, which
blocks the worker on a ``threading.Event`` until the resume endpoint supplies the decision. The
event loop stays free to serve the status/resume/cancel endpoints meanwhile.

Single-process and non-durable by design — abandoned terminal runs are GC'd by TTL.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Optional

from app.modules.workflows.application.execute_workflow import (
    CANCELLED_ERROR,
    WorkflowCancelled,
    WorkflowExecutionResult,
)
from app.modules.workflows.domain.models import ExecutionContext

STATUS_RUNNING = "running"
STATUS_AWAITING_INPUT = "awaiting_input"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"
STATUS_CANCELLED = "cancelled"

_TERMINAL = {STATUS_COMPLETED, STATUS_FAILED, STATUS_CANCELLED}
_TTL_SECONDS = 3600


@dataclass
class ExecutionState:
    execution_id: str
    context: ExecutionContext
    status: str = STATUS_RUNNING
    current_node_id: Optional[str] = None
    pending_decision: Optional[dict] = None
    decision_result: Optional[dict] = None
    cancelled: bool = False
    result: Optional[WorkflowExecutionResult] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    event: threading.Event = field(default_factory=threading.Event, repr=False)
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def is_terminal(self) -> bool:
        return self.status in _TERMINAL


_executions: dict[str, ExecutionState] = {}
_store_lock = threading.Lock()


def create(execution_id: str, context: ExecutionContext) -> ExecutionState:
    state = ExecutionState(execution_id=execution_id, context=context)
    with _store_lock:
        _gc_locked()
        _executions[execution_id] = state
    return state


def get(execution_id: str) -> Optional[ExecutionState]:
    with _store_lock:
        return _executions.get(execution_id)


def _gc_locked() -> None:
    """Drop terminal runs older than the TTL. Caller must hold ``_store_lock``."""
    now = time.time()
    stale = [
        execution_id
        for execution_id, state in _executions.items()
        if state.is_terminal() and now - state.updated_at > _TTL_SECONDS
    ]
    for execution_id in stale:
        _executions.pop(execution_id, None)


def request_decision(state: ExecutionState, payload: dict) -> dict:
    """Called from the worker thread: publish a pending decision, then block until the user resumes
    (or cancels). Returns the user's decision dict; raises ``WorkflowCancelled`` on cancel."""
    with state.lock:
        if state.cancelled:
            raise WorkflowCancelled()
        state.pending_decision = payload
        state.decision_result = None
        state.status = STATUS_AWAITING_INPUT
        state.updated_at = time.time()
        state.event.clear()

    state.event.wait()

    with state.lock:
        if state.cancelled:
            raise WorkflowCancelled()
        decision = state.decision_result or {}
        state.pending_decision = None
        state.status = STATUS_RUNNING
        state.updated_at = time.time()
    return decision


def resume(state: ExecutionState, decision: dict) -> bool:
    """Supply a decision to a suspended run. Returns False if it wasn't awaiting input."""
    with state.lock:
        if state.status != STATUS_AWAITING_INPUT:
            return False
        state.decision_result = decision
        state.status = STATUS_RUNNING
        state.updated_at = time.time()
        state.event.set()
    return True


def cancel(state: ExecutionState) -> bool:
    """Request cancellation. Effective at the next decision point; returns False if already terminal."""
    with state.lock:
        if state.is_terminal():
            return False
        state.cancelled = True
        state.event.set()  # wake a worker that is currently suspended
    return True


def finish(state: ExecutionState, result: WorkflowExecutionResult) -> None:
    with state.lock:
        state.result = result
        state.current_node_id = None
        if result.error == CANCELLED_ERROR:
            state.status = STATUS_CANCELLED
        elif result.error:
            state.status = STATUS_FAILED
        else:
            state.status = STATUS_COMPLETED
        state.updated_at = time.time()


def fail(state: ExecutionState, error: str) -> None:
    with state.lock:
        state.result = WorkflowExecutionResult(error=error)
        state.current_node_id = None
        state.status = STATUS_FAILED
        state.updated_at = time.time()
