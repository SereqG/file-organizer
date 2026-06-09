import { createContext, useContext } from 'react'
import type { LogEntry } from '@/lib/types/workflow'

export interface WorkflowRunState {
  isRunning: boolean
  currentNodeId: string | null
  logEntries: LogEntry[]
}

export interface WorkflowRunContextValue extends WorkflowRunState {
  setRunState: (patch: Partial<WorkflowRunState>) => void
  hasRun: boolean  // true once a run has started (controls panel/button visibility)
}

export const WorkflowRunContext = createContext<WorkflowRunContextValue>({
  isRunning: false,
  currentNodeId: null,
  logEntries: [],
  hasRun: false,
  setRunState: () => {},
})

export function useWorkflowRun() {
  return useContext(WorkflowRunContext)
}
