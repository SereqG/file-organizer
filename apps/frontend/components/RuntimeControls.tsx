'use client'

import { useState } from 'react'
import { LuPlay, LuSettings2 } from 'react-icons/lu'
import { ControlButton } from './ControlButton'
import type { WorkflowDefinition } from '@/lib/types/workflow'
import { useWorkflowReadiness } from '@/hooks/useWorkflowReadiness'

interface RuntimeControlsProps {
  definition: WorkflowDefinition | null
  rootPath: string
}

async function runWorkflow(definition: WorkflowDefinition, rootPath: string): Promise<void> {
  await fetch('/api/workflows/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow: { nodes: definition.nodes, edges: definition.edges, trigger: definition.trigger },
      rootPath,
    }),
  })
}

export function RuntimeControls({ definition, rootPath }: RuntimeControlsProps) {
  const notReadyReason = useWorkflowReadiness(definition)
  const [isRunning, setIsRunning] = useState(false)

  async function handleRun() {
    if (!definition) return
    setIsRunning(true)
    try {
      await runWorkflow(definition, rootPath)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#111] p-1">
      <ControlButton
        label="Run workflow"
        onClick={handleRun}
        disabled={notReadyReason !== null || isRunning}
        disabledReason={notReadyReason ?? undefined}
      >
        <LuPlay size={14} />
      </ControlButton>

      <div className="h-5 w-px bg-white/10" />

      <ControlButton label="Settings" onClick={() => { }}>
        <LuSettings2 size={14} />
      </ControlButton>
    </div>
  )
}
