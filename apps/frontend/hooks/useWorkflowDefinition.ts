'use client'

import { useState, useCallback } from 'react'
import type { Connection } from '@xyflow/react'
import type { CreateFolderNode, DeleteFolderNode, IfNode, RenameFolderNode, SwitchCase, SwitchNode, WorkflowDefinition, WorkflowEdge, WorkflowTriggerNode } from '@/lib/types/workflow'
import type { TriggerId } from '@/components/TriggerSelectModal'

const WORKFLOW_VERSION = '1.0'

function buildTriggerNode(triggerId: TriggerId, id: string): WorkflowTriggerNode {
  if (triggerId === 'manual') {
    return {
      id,
      type: 'manual_trigger',
      category: 'trigger',
      name: 'Manual Trigger',
      version: 1,
      config: {},
    }
  }

  return {
    id,
    type: 'schedule_trigger',
    category: 'trigger',
    name: 'Schedule',
    version: 1,
    config: { cron: '', timezone: 'UTC', enabled: false },
  }
}

function buildIfNode(id: string, label: string): IfNode {
  return {
    id,
    type: 'if',
    category: 'general',
    name: label,
    version: 1,
    config: {
      conditions: { id: `${id}-root`, operator: 'AND', children: [] },
    },
  }
}

// Deterministic case ids derived from the node id, so the React Flow node (built in
// WorkflowControls) and the definition node start with identical output-handle ids. Switch handle
// ids ARE the case ids — unlike the if node's static true/false — so they must agree before the
// node is first configured, otherwise edges connected early would reference unknown branches.
export function initialSwitchCases(nodeId: string): SwitchCase[] {
  return [0, 1].map((i) => ({
    id: `${nodeId}-case-${i}`,
    conditions: { id: `${nodeId}-group-${i}`, operator: 'AND', children: [] },
  }))
}

function buildSwitchNode(id: string, label: string): SwitchNode {
  return {
    id,
    type: 'switch',
    category: 'general',
    name: label,
    version: 1,
    config: {
      cases: initialSwitchCases(id),
    },
  }
}

function buildCreateFolderNode(id: string, label: string): CreateFolderNode {
  return {
    id,
    type: 'createFolder',
    category: 'general',
    name: label,
    version: 1,
    config: {
      folderName: '',
      parentFolderPath: '',
      ifExists: 'reuse_existing',
    },
  }
}

function buildDeleteFolderNode(id: string, label: string): DeleteFolderNode {
  return {
    id,
    type: 'deleteFolder',
    category: 'general',
    name: label,
    version: 1,
    config: {
      deleteAllEncountered: false,
      folderPaths: [],
    },
  }
}

function buildRenameFolderNode(id: string, label: string): RenameFolderNode {
  return {
    id,
    type: 'renameFolder',
    category: 'general',
    name: label,
    version: 1,
    config: {
      folderPath: '',
      newName: '',
      ifExists: 'fail',
    },
  }
}

export function useWorkflowDefinition() {
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null)

  const addTrigger = useCallback((triggerId: TriggerId, rfNodeId: string) => {
    const trigger = buildTriggerNode(triggerId, rfNodeId)
    setDefinition({ version: WORKFLOW_VERSION, trigger, nodes: [], edges: [] })
  }, [])

  const removeTrigger = useCallback(() => {
    setDefinition(null)
  }, [])

  const addGeneralNode = useCallback((id: string, nodeType: string, label: string) => {
    setDefinition((prev) => {
      if (!prev) return prev
      if (nodeType === 'if') return { ...prev, nodes: [...prev.nodes, buildIfNode(id, label)] }
      if (nodeType === 'switch') return { ...prev, nodes: [...prev.nodes, buildSwitchNode(id, label)] }
      if (nodeType === 'createFolder') return { ...prev, nodes: [...prev.nodes, buildCreateFolderNode(id, label)] }
      if (nodeType === 'deleteFolder') return { ...prev, nodes: [...prev.nodes, buildDeleteFolderNode(id, label)] }
      if (nodeType === 'renameFolder') return { ...prev, nodes: [...prev.nodes, buildRenameFolderNode(id, label)] }
      return prev
    })
  }, [])

  const removeNode = useCallback((id: string) => {
    setDefinition((prev) => {
      if (!prev) return prev
      return { ...prev, nodes: prev.nodes.filter((n) => n.id !== id) }
    })
  }, [])

  const updateIfNodeConfig = useCallback((id: string, config: IfNode['config']) => {
    setDefinition((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === id && n.type === 'if' ? { ...n, config } : n)),
      }
    })
  }, [])

  const updateSwitchNodeConfig = useCallback((id: string, config: SwitchNode['config']) => {
    setDefinition((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === id && n.type === 'switch' ? { ...n, config } : n)),
      }
    })
  }, [])

  const updateCreateFolderNodeConfig = useCallback((id: string, config: CreateFolderNode['config']) => {
    setDefinition((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === id && n.type === 'createFolder' ? { ...n, config } : n)),
      }
    })
  }, [])

  const updateDeleteFolderNodeConfig = useCallback((id: string, config: DeleteFolderNode['config']) => {
    setDefinition((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === id && n.type === 'deleteFolder' ? { ...n, config } : n)),
      }
    })
  }, [])

  const updateRenameFolderNodeConfig = useCallback((id: string, config: RenameFolderNode['config']) => {
    setDefinition((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === id && n.type === 'renameFolder' ? { ...n, config } : n)),
      }
    })
  }, [])

  const addWorkflowEdge = useCallback((connection: Connection) => {
    setDefinition((prev) => {
      if (!prev) return prev
      const edge: WorkflowEdge = {
        id: `${connection.source}-${connection.sourceHandle ?? 'default'}->${connection.target}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
      }
      return { ...prev, edges: [...prev.edges, edge] }
    })
  }, [])

  const removeWorkflowEdge = useCallback((id: string) => {
    setDefinition((prev) => {
      if (!prev) return prev
      return { ...prev, edges: prev.edges.filter((e) => e.id !== id) }
    })
  }, [])

  return {
    definition,
    addTrigger,
    removeTrigger,
    addGeneralNode,
    removeNode,
    updateIfNodeConfig,
    updateSwitchNodeConfig,
    updateCreateFolderNodeConfig,
    updateDeleteFolderNodeConfig,
    updateRenameFolderNodeConfig,
    addWorkflowEdge,
    removeWorkflowEdge,
  }
}
