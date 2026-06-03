'use client'

import { useEffect, useState } from 'react'
import { LuPlay, LuLoaderCircle, LuSettings2 } from 'react-icons/lu'
import { ControlButton } from './ControlButton'
import { ExecutionResultPopup } from './ExecutionResultPopup'
import { WorkflowPreviewModal } from './WorkflowPreviewModal'
import { DecisionModal } from './DecisionModal'
import type { ConfigRemap, ExecutionFailedNode, WorkflowDefinition, WorkflowPreview } from '@/lib/types/workflow'
import { useWorkflowReadiness } from '@/hooks/useWorkflowReadiness'
import { useWorkflowExecution } from '@/hooks/useWorkflowExecution'

interface RuntimeControlsProps {
  definition: WorkflowDefinition | null
  rootPath: string
  onRunStart: () => void
  onRunComplete: (failedNodes: ExecutionFailedNode[]) => void
  onConfigRemap: (remaps: ConfigRemap[]) => void
}

async function previewWorkflow(definition: WorkflowDefinition, rootPath: string): Promise<WorkflowPreview> {
  const res = await fetch('/api/workflows/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow: { nodes: definition.nodes, edges: definition.edges, trigger: definition.trigger },
      rootPath,
      mode: 'dryRun',
    }),
  })
  const data = await res.json()

  if (!res.ok) {
    return { ok: false, error: data.error ?? 'Could not preview the workflow', actions: [], warnings: [], failedNodes: data.failedNodes ?? [] }
  }
  return {
    ok: data.ok ?? false,
    error: data.error ?? null,
    actions: data.actions ?? [],
    warnings: data.warnings ?? [],
    failedNodes: data.failedNodes ?? [],
  }
}

export function RuntimeControls({ definition, rootPath, onRunStart, onRunComplete, onConfigRemap }: RuntimeControlsProps) {
  const notReadyReason = useWorkflowReadiness(definition)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [preview, setPreview] = useState<WorkflowPreview | null>(null)
  const execution = useWorkflowExecution()

  // A finished run reports its failed nodes (for canvas marking) and any path remaps it produced.
  useEffect(() => {
    if (!execution.result) return
    onRunComplete(execution.result.failedNodes)
    onConfigRemap(execution.result.configRemap)
  }, [execution.result, onRunComplete, onConfigRemap])

  async function handleRun() {
    if (!definition) return
    onRunStart()
    execution.clearResult()
    setIsPreviewing(true)
    try {
      setPreview(await previewWorkflow(definition, rootPath))
    } finally {
      setIsPreviewing(false)
    }
  }

  function handleConfirm() {
    if (!definition) return
    setPreview(null)
    void execution.start(definition, rootPath)
  }

  const isBusy = isPreviewing || execution.isRunning

  return (
    <>
      <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#111] p-1">
        <ControlButton
          label="Run workflow"
          onClick={handleRun}
          disabled={notReadyReason !== null || isBusy}
          disabledReason={notReadyReason ?? undefined}
        >
          {isBusy
            ? <LuLoaderCircle size={14} className="animate-spin" />
            : <LuPlay size={14} />
          }
        </ControlButton>

        <div className="h-5 w-px bg-white/10" />

        <ControlButton label="Settings" onClick={() => { }}>
          <LuSettings2 size={14} />
        </ControlButton>
      </div>

      {preview && (
        <WorkflowPreviewModal
          preview={preview}
          onConfirm={handleConfirm}
          onCancel={() => setPreview(null)}
        />
      )}

      {execution.pendingDecision && (
        <DecisionModal
          decision={execution.pendingDecision}
          onChoose={(option) => execution.submitDecision({ resolution: option })}
          onCancel={execution.cancel}
        />
      )}

      {execution.result && (
        <ExecutionResultPopup
          result={execution.result}
          onClose={execution.clearResult}
        />
      )}
    </>
  )
}
