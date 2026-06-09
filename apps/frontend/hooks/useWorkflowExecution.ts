'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConfigRemap, ExecutionResult, LogEntry, PendingDecision, WorkflowDefinition } from '@/lib/types/workflow'

const INITIAL_POLL_MS = 500
const BACKOFF_FACTOR = 1.4
const MAX_POLL_MS = 2500
const HARD_TIMEOUT_MS = 600_000

interface ExecutionState {
  isRunning: boolean
  pendingDecision: PendingDecision | null
  result: ExecutionResult | null
  currentNodeId: string | null
  logEntries: LogEntry[]
}

const IDLE: ExecutionState = { isRunning: false, pendingDecision: null, result: null, currentNodeId: null, logEntries: [] }

/**
 * Drives a resumable workflow run: starts it, polls status with backoff, surfaces a pending decision
 * when the engine suspends, and posts the user's choice (or a cancel) to resume.
 * Log entries stream in real time via SSE; status/decision changes come from the poll.
 */
export function useWorkflowExecution() {
  const [state, setState] = useState<ExecutionState>(IDLE)
  const execIdRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollRef = useRef<() => void>(() => {})
  const attemptRef = useRef(0)
  const startedAtRef = useRef(0)
  const [streamExecId, setStreamExecId] = useState<string | null>(null)

  // Real-time log streaming via SSE fetch stream.
  useEffect(() => {
    if (!streamExecId) return

    let active = true
    const controller = new AbortController()

    async function stream() {
      let res: Response
      try {
        res = await fetch(`/api/workflows/execute/${streamExecId}/logs`, {
          signal: controller.signal,
        })
      } catch {
        return
      }

      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (active) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const entry = JSON.parse(line.slice(6)) as LogEntry
              setState((s) => ({ ...s, logEntries: [...s.logEntries, entry] }))
            } catch {}
          }
        }
      } catch {}
    }

    stream()

    return () => {
      active = false
      controller.abort()
    }
  }, [streamExecId])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const finish = useCallback((
    result: Omit<ExecutionResult, 'configRemap'> & { configRemap?: ConfigRemap[] },
  ) => {
    clearTimer()
    execIdRef.current = null
    setStreamExecId(null)
    setState((s) => ({
      ...s,
      isRunning: false,
      pendingDecision: null,
      currentNodeId: null,
      result: { ...result, configRemap: result.configRemap ?? [] },
    }))
  }, [clearTimer])

  const scheduleNext = useCallback(() => {
    const delay = Math.min(INITIAL_POLL_MS * BACKOFF_FACTOR ** attemptRef.current, MAX_POLL_MS)
    attemptRef.current += 1
    timerRef.current = setTimeout(() => pollRef.current(), delay)
  }, [])

  const poll = useCallback(async () => {
    const execId = execIdRef.current
    if (!execId) return

    if (Date.now() - startedAtRef.current > HARD_TIMEOUT_MS) {
      finish({ success: false, error: 'Workflow timed out.', failedNodes: [], warnings: [] })
      return
    }

    let res: Response
    try {
      res = await fetch(`/api/workflows/execute/${execId}`)
    } catch {
      finish({ success: false, error: 'Lost connection to the server.', failedNodes: [], warnings: [] })
      return
    }
    if (!res.ok) {
      finish({ success: false, error: 'Failed to read execution status.', failedNodes: [], warnings: [] })
      return
    }

    const data = await res.json()
    if (execIdRef.current !== execId) return

    switch (data.status) {
      case 'awaiting_input':
        setState((s) => ({
          ...s,
          pendingDecision: data.pendingDecision ?? null,
          currentNodeId: data.currentNodeId ?? null,
        }))
        return
      case 'completed':
        finish({ success: true, failedNodes: [], warnings: data.warnings ?? [], configRemap: data.configRemap ?? [] })
        return
      case 'failed':
        finish({
          success: false,
          error: data.error ?? 'Workflow failed.',
          failedNodes: data.failedNodes ?? [],
          warnings: data.warnings ?? [],
        })
        return
      case 'cancelled':
        finish({ success: false, error: 'Workflow cancelled.', failedNodes: [], warnings: data.warnings ?? [] })
        return
      default:
        setState((s) => ({
          ...s,
          pendingDecision: null,
          currentNodeId: data.currentNodeId ?? null,
        }))
        scheduleNext()
    }
  }, [finish, scheduleNext])

  useEffect(() => {
    pollRef.current = poll
  }, [poll])

  useEffect(() => clearTimer, [clearTimer])

  const start = useCallback(async (definition: WorkflowDefinition, rootPath: string) => {
    clearTimer()
    attemptRef.current = 0
    startedAtRef.current = Date.now()
    setState({ isRunning: true, pendingDecision: null, result: null, currentNodeId: null, logEntries: [] })
    setStreamExecId(null)

    let res: Response
    try {
      res = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: { nodes: definition.nodes, edges: definition.edges, trigger: definition.trigger },
          rootPath,
          mode: 'run',
        }),
      })
    } catch {
      finish({ success: false, error: 'Could not start the workflow.', failedNodes: [], warnings: [] })
      return
    }

    if (res.status !== 202) {
      const data = await res.json().catch(() => ({}))
      finish({
        success: false,
        error: data.error ?? 'Failed to start the workflow.',
        failedNodes: data.failedNodes ?? [],
        warnings: data.warnings ?? [],
      })
      return
    }

    const data = await res.json()
    execIdRef.current = data.executionId
    setStreamExecId(data.executionId)
    timerRef.current = setTimeout(() => pollRef.current(), INITIAL_POLL_MS)
  }, [clearTimer, finish])

  const submitDecision = useCallback(async (decision: Record<string, unknown>) => {
    const execId = execIdRef.current
    if (!execId) return
    setState((s) => ({ ...s, pendingDecision: null }))
    try {
      await fetch(`/api/workflows/execute/${execId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
    } catch {
      finish({ success: false, error: 'Lost connection while resuming.', failedNodes: [], warnings: [] })
      return
    }
    attemptRef.current = 0
    timerRef.current = setTimeout(() => pollRef.current(), INITIAL_POLL_MS)
  }, [finish])

  const cancel = useCallback(async () => {
    const execId = execIdRef.current
    if (!execId) return
    setState((s) => ({ ...s, pendingDecision: null }))
    try {
      await fetch(`/api/workflows/execute/${execId}/cancel`, { method: 'POST' })
    } catch {
      // Best-effort; polling will report the terminal status.
    }
    attemptRef.current = 0
    timerRef.current = setTimeout(() => pollRef.current(), INITIAL_POLL_MS)
  }, [])

  const clearResult = useCallback(() => setState((s) => ({ ...s, result: null })), [])

  return {
    isRunning: state.isRunning,
    pendingDecision: state.pendingDecision,
    result: state.result,
    currentNodeId: state.currentNodeId,
    logEntries: state.logEntries,
    start,
    submitDecision,
    cancel,
    clearResult,
  }
}
