"""Launches a workflow as a background, resumable execution.

The synchronous engine runs in a threadpool worker (``run_in_executor``) so its blocking
``request_decision`` pauses don't stall the event loop. Status/resume/cancel are served from the
loop via :mod:`execution_store`.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime
from pathlib import Path

from app.modules.workflows.application import execution_store
from app.modules.workflows.application.execute_workflow import execute_workflow
from app.modules.workflows.application.execution_store import ExecutionState
from app.modules.workflows.domain.models import ExecutionContext, Workflow

_LOG_DIR = Path(__file__).resolve().parents[4] / "logs"


async def start_execution(workflow: Workflow, context: ExecutionContext) -> str:
    """Register the execution and kick off its background worker. Returns the execution id."""
    execution_id = str(context.execution_id)
    state = execution_store.create(execution_id, context)
    asyncio.create_task(_run(state, workflow))
    return execution_id


def _execution_log_path(execution_id: str) -> Path:
    return _LOG_DIR / f"execution-{execution_id}.log"


def _init_execution_log(execution_id: str, context: ExecutionContext) -> Path:
    """Create the log file for this execution if it does not already exist."""
    _LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = _execution_log_path(execution_id)
    if not log_path.exists():
        with log_path.open("w", encoding="utf-8") as f:
            f.write(f"execution_id: {execution_id}\n")
            f.write(f"started_at: {context.started_at.isoformat()}\n")
            f.write(f"root_path: {context.root_path}\n")
    return log_path


def _flush_execution_log(log_path: Path, context: ExecutionContext, status: str) -> None:
    """Append the final status and all collected log entries to the execution log file."""
    with log_path.open("a", encoding="utf-8") as f:
        f.write(f"finished_at: {datetime.utcnow().isoformat()}\n")
        f.write(f"status: {status}\n")
        f.write("---\n")
        for entry in context.log_entries:
            line = f"[{entry.elapsed:8.3f}s] [{entry.kind:<8}] {entry.node_name}: {entry.item_name}"
            if entry.message:
                line += f" — {entry.message}"
            f.write(line + "\n")


def _set_current_node(state: ExecutionState, node_id: str) -> None:
    with state.lock:
        state.current_node_id = node_id
        state.updated_at = time.time()


async def _run(state: ExecutionState, workflow: Workflow) -> None:
    loop = asyncio.get_running_loop()
    log_path = _init_execution_log(state.execution_id, state.context)

    def blocking() -> None:
        state.context.request_decision = lambda payload: execution_store.request_decision(state, payload)
        state.context.on_node_start = lambda node_id, name: _set_current_node(state, node_id)
        return execute_workflow(workflow, state.context)

    try:
        result = await loop.run_in_executor(None, blocking)
    except Exception as exc:  # noqa: BLE001 - surface any unexpected worker failure as a failed run.
        execution_store.fail(state, f"Execution worker crashed: {exc}")
        _flush_execution_log(log_path, state.context, "crashed")
        return

    execution_store.finish(state, result)
    _flush_execution_log(log_path, state.context, state.status)
