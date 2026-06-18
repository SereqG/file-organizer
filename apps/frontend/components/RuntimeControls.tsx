'use client'

import { useEffect, useState } from 'react'
import { LuPlay, LuLoaderCircle, LuSettings2 } from 'react-icons/lu'
import { ControlButton } from './ControlButton'
import { ExecutionResultPopup } from './ExecutionResultPopup'
import { WorkflowPreviewModal } from './WorkflowPreviewModal'
import { RunSettingsModal } from './RunSettingsModal'
import { DecisionModal } from './DecisionModal'
import type { ConfigRemap, ExecutionFailedNode, WorkflowDefinition, WorkflowNode } from '@/lib/types/workflow'
import { useWorkflowReadiness } from '@/hooks/useWorkflowReadiness'
import { useWorkflowExecution } from '@/hooks/useWorkflowExecution'
import { useWorkflowRun } from '@/lib/contexts/WorkflowRunContext'
import type { WorkflowPreview } from '@/lib/types/workflow'
import { resolveRunNodes } from '@/lib/workflow/resolveRunNodes'

const DRY_RUN_ONLY_KEY = 'workflow:dryRunOnly'

interface RuntimeControlsProps {
  definition: WorkflowDefinition | null
  rootPath: string
  onRunStart: () => void
  onRunComplete: (failedNodes: ExecutionFailedNode[]) => void
  onConfigRemap: (remaps: ConfigRemap[]) => void
  isExploring: boolean
}

async function previewWorkflow(
  definition: WorkflowDefinition,
  rootPath: string,
  resolvedNodes: WorkflowNode[],
): Promise<WorkflowPreview> {
  const res = await fetch('/api/workflows/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow: { nodes: resolvedNodes, edges: definition.edges, trigger: definition.trigger },
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
    finalTree: data.finalTree ?? null,
    previewToken: data.previewToken,
  }
}

export function RuntimeControls({ definition, rootPath, onRunStart, onRunComplete, onConfigRemap, isExploring }: RuntimeControlsProps) {
  const notReadyReason = useWorkflowReadiness(definition)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [preview, setPreview] = useState<WorkflowPreview | null>(null)
  const [pendingResolvedNodes, setPendingResolvedNodes] = useState<WorkflowNode[] | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isDryRunOnly, setIsDryRunOnly] = useState(() => {
    try { return localStorage.getItem(DRY_RUN_ONLY_KEY) === 'true' } catch { return false }
  })
  const execution = useWorkflowExecution()
  const { setRunState } = useWorkflowRun()

  function handleToggleDryRunOnly(value: boolean) {
    setIsDryRunOnly(value)
    try { localStorage.setItem(DRY_RUN_ONLY_KEY, String(value)) } catch {}
  }

  useEffect(() => {
    if (!execution.result) return
    onRunComplete(execution.result.failedNodes)
    onConfigRemap(execution.result.configRemap)
  }, [execution.result, onRunComplete, onConfigRemap])

  useEffect(() => {
    setRunState({
      isRunning: execution.isRunning,
      currentNodeId: execution.currentNodeId,
      logEntries: execution.logEntries,
    })
  }, [execution.isRunning, execution.currentNodeId, execution.logEntries, setRunState])

  async function handleRun() {
    if (!definition) return

    const resolvedNodes = resolveRunNodes(definition.nodes)
    const resolvedById = new Map(resolvedNodes.map((r) => [r.id, r.config as Record<string, unknown>]))
    const orphanedNode = definition.nodes.find(
      (n) =>
        n.type === 'ai_classifier' &&
        n.config.categoryIds.length > 0 &&
        (resolvedById.get(n.id)?.categories as unknown[])?.length === 0,
    )
    if (orphanedNode) {
      setPreview({
        ok: false,
        error: `AI Classifier "${orphanedNode.name}": selected categories no longer exist in the library. Open the node and re-select categories.`,
        actions: [],
        warnings: [],
        failedNodes: [],
      })
      return
    }

    onRunStart()
    execution.clearResult()
    setIsPreviewing(true)

    try {
      const result = await previewWorkflow(definition, rootPath, resolvedNodes)
      setPreview(result)
      setPendingResolvedNodes(resolvedNodes)
    } finally {
      setIsPreviewing(false)
    }
  }

  function handleConfirm() {
    if (!definition || !pendingResolvedNodes) return
    const token = preview?.previewToken
    setPreview(null)
    const resolvedDefinition = { ...definition, nodes: pendingResolvedNodes }
    void execution.start(resolvedDefinition, rootPath, token)
    setPendingResolvedNodes(null)
  }

  function handleCancel() {
    setPreview(null)
    setPendingResolvedNodes(null)
  }

  const isBusy = isPreviewing || execution.isRunning || isExploring

  return (
    <>
      <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#111] p-1">
        <ControlButton
          label="Run workflow"
          onClick={handleRun}
          disabled={notReadyReason !== null || isBusy}
          disabledReason={notReadyReason ?? (isExploring ? 'File system exploration in progress' : undefined)}
        >
          {isBusy
            ? <LuLoaderCircle size={14} className="animate-spin" />
            : <LuPlay size={14} />
          }
        </ControlButton>

        <div className="h-5 w-px bg-white/10" />

        <ControlButton label="Settings" onClick={() => setIsSettingsOpen(true)}>
          <LuSettings2 size={14} />
        </ControlButton>
      </div>

      {preview && (
        <WorkflowPreviewModal
          preview={preview}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          isDryRunOnly={isDryRunOnly}
        />
      )}

      {isSettingsOpen && (
        <RunSettingsModal
          isDryRunOnly={isDryRunOnly}
          onToggleDryRunOnly={handleToggleDryRunOnly}
          onClose={() => setIsSettingsOpen(false)}
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
