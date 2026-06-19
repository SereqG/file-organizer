'use client'

import { useCallback, useState } from 'react'
import type { WorkflowDefinition } from '@/lib/types/workflow'
import type { RunHistoryDetail, RunHistoryEntry, SavedWorkflow, SavedWorkflowSummary } from '@/lib/types/persistence'

/**
 * Data layer for the workflow library: saved workflows (save/load/delete) and run history. The
 * session is resolved server-side from the httpOnly cookie by the route handlers, so nothing here
 * passes a session id. Lists are fetched on demand (panel open / after a mutation).
 */
export function useWorkflowLibrary() {
  const [definitions, setDefinitions] = useState<SavedWorkflowSummary[]>([])
  const [runs, setRuns] = useState<RunHistoryEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const [defRes, runRes] = await Promise.all([
        fetch('/api/workflows/definitions'),
        fetch('/api/workflows/runs'),
      ])
      const defData = await defRes.json().catch(() => ({}))
      const runData = await runRes.json().catch(() => ({}))
      setDefinitions(defRes.ok ? (defData.definitions ?? []) : [])
      setRuns(runRes.ok ? (runData.runs ?? []) : [])
    } catch {
      setError('Could not load your library.')
    }
  }, [])

  const save = useCallback(async (name: string, definition: WorkflowDefinition): Promise<boolean> => {
    setError(null)
    try {
      const res = await fetch('/api/workflows/definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, definition }),
      })
      if (!res.ok) {
        setError('Could not save the workflow.')
        return false
      }
      await refresh()
      return true
    } catch {
      setError('Could not save the workflow.')
      return false
    }
  }, [refresh])

  const remove = useCallback(async (id: string): Promise<void> => {
    setError(null)
    try {
      await fetch(`/api/workflows/definitions/${id}`, { method: 'DELETE' })
      await refresh()
    } catch {
      setError('Could not delete the workflow.')
    }
  }, [refresh])

  const load = useCallback(async (id: string): Promise<WorkflowDefinition | null> => {
    setError(null)
    try {
      const res = await fetch(`/api/workflows/definitions/${id}`)
      if (!res.ok) {
        setError('Could not load the workflow.')
        return null
      }
      const data = (await res.json()) as SavedWorkflow
      return data.definition
    } catch {
      setError('Could not load the workflow.')
      return null
    }
  }, [])

  const getRun = useCallback(async (id: string): Promise<RunHistoryDetail | null> => {
    setError(null)
    try {
      const res = await fetch(`/api/workflows/runs/${id}`)
      if (!res.ok) return null
      return (await res.json()) as RunHistoryDetail
    } catch {
      return null
    }
  }, [])

  return { definitions, runs, error, refresh, save, remove, load, getRun }
}
