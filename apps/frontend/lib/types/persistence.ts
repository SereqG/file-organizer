import type { WorkflowDefinition } from './workflow'

// A saved workflow as listed in the library (no definition body — that is fetched on load).
export interface SavedWorkflowSummary {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface SavedWorkflow extends SavedWorkflowSummary {
  definition: WorkflowDefinition
}

// Compact digest of a finished run, stored when it completes.
export interface RunHistorySummary {
  rootPath?: string
  executedNodes?: number
  warnings?: number
  error?: string | null
}

export interface RunHistoryEntry {
  id: string
  status: string
  startedAt: number | null
  finishedAt: number | null
  summary: RunHistorySummary | null
}

export interface RunHistoryDetail extends RunHistoryEntry {
  log: string | null
}
