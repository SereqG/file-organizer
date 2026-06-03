"""Launches a workflow as a background, resumable execution.

The synchronous engine runs in a threadpool worker (``run_in_executor``) so its blocking
``request_decision`` pauses don't stall the event loop. Status/resume/cancel are served from the
loop via :mod:`execution_store`.
"""

from __future__ import annotations

import asyncio

from app.modules.workflows.application import execution_store
from app.modules.workflows.application.execute_workflow import execute_workflow
from app.modules.workflows.application.execution_store import ExecutionState
from app.modules.workflows.domain.models import ExecutionContext, Workflow


async def start_execution(workflow: Workflow, context: ExecutionContext) -> str:
    """Register the execution and kick off its background worker. Returns the execution id."""
    execution_id = str(context.execution_id)
    state = execution_store.create(execution_id, context)
    asyncio.create_task(_run(state, workflow))
    return execution_id


async def _run(state: ExecutionState, workflow: Workflow) -> None:
    loop = asyncio.get_running_loop()

    def blocking() -> None:
        # Wire the engine's pause hook to this run's store entry, then execute synchronously.
        state.context.request_decision = lambda payload: execution_store.request_decision(state, payload)
        return execute_workflow(workflow, state.context)

    try:
        result = await loop.run_in_executor(None, blocking)
    except Exception as exc:  # noqa: BLE001 - surface any unexpected worker failure as a failed run.
        execution_store.fail(state, f"Execution worker crashed: {exc}")
        return

    execution_store.finish(state, result)
