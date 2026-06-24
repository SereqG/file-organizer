'use client'

import { useCallback, useRef, useState } from 'react'
import type { NodeSimulationResult, WorkflowDefinition } from '@/lib/types/workflow'
import { resolveRunNodes } from '@/lib/workflow/resolveRunNodes'
import { useOpenRouterKey } from '@/lib/workflow/stores/openRouterKey'

const EMPTY: NodeSimulationResult = { tree: null, scopeItemIds: [], ok: false, error: null }

/**
 * Per-node dry-run simulation for the editor: `simulateNode(X)` returns the predicted tree on entry
 * to node X (`stopBefore`), so a config modal's pickers can preview upstream changes.
 *
 * Results are memoized on a hash of the (resolved) definition: re-opening the same modal without
 * editing anything reuses the cached result and avoids redundant calls (the backend AI cache covers
 * any remaining model cost). `stopBefore` halts before X, so AI nodes after X never fire.
 */
export function useWorkflowSimulation(definition: WorkflowDefinition | null, rootPath: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef<Map<string, NodeSimulationResult>>(new Map())
  const { apiKey, isAiAvailable } = useOpenRouterKey()

  const simulateNode = useCallback(async (nodeId: string): Promise<NodeSimulationResult> => {
    if (!definition) return EMPTY

    const resolvedNodes = resolveRunNodes(definition.nodes)
    const defHash = JSON.stringify({ nodes: resolvedNodes, edges: definition.edges, trigger: definition.trigger })
    // Availability is part of the key so flipping the API key on/off invalidates a stale no-key result.
    const key = `${defHash}::${nodeId}::${isAiAvailable}`

    const cached = cacheRef.current.get(key)
    if (cached) {
      setError(cached.ok ? null : cached.error)
      return cached
    }

    const aiKey = isAiAvailable && resolvedNodes.some((n) => n.type === 'ai_classifier') ? apiKey : undefined

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: { nodes: resolvedNodes, edges: definition.edges, trigger: definition.trigger },
          rootPath,
          mode: 'dryRun',
          stopBefore: nodeId,
          ...(aiKey ? { apiKey: aiKey } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      const result: NodeSimulationResult = res.ok
        ? {
            tree: data.predictedTree ?? null,
            scopeItemIds: data.scopeItemIds ?? [],
            ok: data.ok ?? false,
            error: data.error ?? null,
          }
        : { tree: null, scopeItemIds: [], ok: false, error: data.error ?? 'Could not simulate the workflow.' }

      cacheRef.current.set(key, result)
      if (!result.ok) setError(result.error)
      return result
    } catch {
      const result: NodeSimulationResult = { tree: null, scopeItemIds: [], ok: false, error: 'Could not simulate the workflow.' }
      setError(result.error)
      return result
    } finally {
      setLoading(false)
    }
  }, [definition, rootPath, apiKey, isAiAvailable])

  const simulateNodeForced = useCallback(async (nodeId: string): Promise<NodeSimulationResult> => {
    if (!definition) return EMPTY
    const resolvedNodes = resolveRunNodes(definition.nodes)
    const defHash = JSON.stringify({ nodes: resolvedNodes, edges: definition.edges, trigger: definition.trigger })
    cacheRef.current.delete(`${defHash}::${nodeId}::${isAiAvailable}`)
    return simulateNode(nodeId)
  }, [definition, simulateNode, isAiAvailable])

  return { simulateNode, simulateNodeForced, loading, error }
}
