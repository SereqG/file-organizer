'use client'

import { useState } from 'react'
import { LuPlay, LuLoaderCircle, LuSettings2 } from 'react-icons/lu'
import { ControlButton } from './ControlButton'
import { ExecutionResultPopup } from './ExecutionResultPopup'
import type { ExecutionFailedNode, ExecutionResult, WorkflowDefinition } from '@/lib/types/workflow'
import { useWorkflowReadiness } from '@/hooks/useWorkflowReadiness'

interface RuntimeControlsProps {
  definition: WorkflowDefinition | null
  rootPath: string
  onRunStart: () => void
  onRunComplete: (failedNodes: ExecutionFailedNode[]) => void
}

async function runWorkflow(definition: WorkflowDefinition, rootPath: string): Promise<ExecutionResult> {
  const res = await fetch('/api/workflows/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow: { nodes: definition.nodes, edges: definition.edges, trigger: definition.trigger },
      rootPath,
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    return {
      success: false,
      error: data.error ?? 'Workflow execution failed',
      failedNodes: data.failedNodes ?? [],
    }
  }

  return { success: true, failedNodes: [] }
}

export function RuntimeControls({ definition, rootPath, onRunStart, onRunComplete }: RuntimeControlsProps) {
  const notReadyReason = useWorkflowReadiness(definition)
  const [isRunning, setIsRunning] = useState(false)
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null)

  async function handleRun() {
    if (!definition) return
    onRunStart()
    setExecutionResult(null)
    setIsRunning(true)
    try {
      const result = await runWorkflow(definition, rootPath)
      setExecutionResult(result)
      onRunComplete(result.failedNodes)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#111] p-1">
        <ControlButton
          label="Run workflow"
          onClick={handleRun}
          disabled={notReadyReason !== null || isRunning}
          disabledReason={notReadyReason ?? undefined}
        >
          {isRunning
            ? <LuLoaderCircle size={14} className="animate-spin" />
            : <LuPlay size={14} />
          }
        </ControlButton>

        <div className="h-5 w-px bg-white/10" />

        <ControlButton label="Settings" onClick={() => { }}>
          <LuSettings2 size={14} />
        </ControlButton>
      </div>

      {executionResult && (
        <ExecutionResultPopup
          result={executionResult}
          onClose={() => setExecutionResult(null)}
        />
      )}
    </>
  )
}
