'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNodesState, useEdgesState, addEdge } from '@xyflow/react'
import type { Edge, Connection } from '@xyflow/react'
import type { TriggerId } from '@/components/TriggerSelectModal'
import type { CreateFolderNode as CreateFolderNodeType, IfNode as IfNodeType } from '@/lib/types/workflow'
import { useWorkflowDefinition } from '@/hooks/useWorkflowDefinition'
import { TriggerNode } from '@/components/nodes/trigger_node/TriggerNode'
import type { TriggerRFNode } from '@/components/nodes/trigger_node/TriggerNode'
import { IfNode } from '@/components/nodes/if_node/IfNode'
import type { IfRFNode } from '@/components/nodes/if_node/IfNode'
import { CreateFolderNode } from '@/components/nodes/create_folder_node/CreateFolderNode'
import type { CreateFolderRFNode } from '@/components/nodes/create_folder_node/CreateFolderNode'

export type AppNode = TriggerRFNode | IfRFNode | CreateFolderRFNode

const NODE_TYPES = { trigger: TriggerNode, if: IfNode, createFolder: CreateFolderNode }

export function useWorkflowEditor() {
  const [mounted, setMounted] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const nodeTypes = useMemo(() => NODE_TYPES, [])
  const dropHandlerRef = useRef<((e: React.DragEvent<HTMLDivElement>) => void) | null>(null)
  const hasTrigger = nodes.some((n) => n.type === 'trigger')
  const [editingIfNodeId, setEditingIfNodeId] = useState<string | null>(null)
  const [editingCreateFolderNodeId, setEditingCreateFolderNodeId] = useState<string | null>(null)

  const {
    definition,
    addTrigger,
    removeTrigger,
    addGeneralNode,
    removeNode,
    updateIfNodeConfig,
    updateCreateFolderNodeConfig,
    addWorkflowEdge,
    removeWorkflowEdge,
  } = useWorkflowDefinition()

  const handleTriggerAdded = useCallback((triggerId: TriggerId) => {
    addTrigger(triggerId)
  }, [addTrigger])

  const handleGeneralNodeAdded = useCallback((id: string, nodeType: string, label: string) => {
    addGeneralNode(id, nodeType, label)
  }, [addGeneralNode])

  const handleNodesDelete = useCallback((deleted: AppNode[]) => {
    for (const node of deleted) {
      if (node.type === 'trigger') {
        removeTrigger()
      } else {
        removeNode(node.id)
      }
    }
  }, [removeTrigger, removeNode])

  const handleConnect = useCallback((connection: Connection) => {
    const edgeId = `${connection.source}-${connection.sourceHandle ?? 'default'}->${connection.target}`
    setEdges((prev) => addEdge({ ...connection, id: edgeId }, prev))
    addWorkflowEdge(connection)
  }, [setEdges, addWorkflowEdge])

  const handleEdgesDelete = useCallback((deleted: Edge[]) => {
    for (const edge of deleted) {
      removeWorkflowEdge(edge.id)
    }
  }, [removeWorkflowEdge])

  const nodeConfigValue = useMemo(() => ({
    openIfNodeConfig: (id: string) => setEditingIfNodeId(id),
    openCreateFolderNodeConfig: (id: string) => setEditingCreateFolderNodeId(id),
  }), [])

  const handleIfConfigSave = useCallback((config: IfNodeType['config']) => {
    if (!editingIfNodeId) return
    setNodes((prev) => prev.map((n) =>
      n.id === editingIfNodeId ? { ...n, data: { ...n.data, config } } as AppNode : n
    ))
    updateIfNodeConfig(editingIfNodeId, config)
  }, [editingIfNodeId, setNodes, updateIfNodeConfig])

  const handleCreateFolderConfigSave = useCallback((config: CreateFolderNodeType['config']) => {
    if (!editingCreateFolderNodeId) return
    setNodes((prev) => prev.map((n) =>
      n.id === editingCreateFolderNodeId ? { ...n, data: { ...n.data, config } } as AppNode : n
    ))
    updateCreateFolderNodeConfig(editingCreateFolderNodeId, config)
  }, [editingCreateFolderNodeId, setNodes, updateCreateFolderNodeConfig])

  useEffect(() => {
    setMounted(true)
  }, [])

  return {
    mounted,
    definition,
    nodes,
    edges,
    nodeTypes,
    dropHandlerRef,
    hasTrigger,
    editingIfNodeId,
    editingCreateFolderNodeId,
    nodeConfigValue,
    onNodesChange,
    onEdgesChange,
    handleTriggerAdded,
    handleGeneralNodeAdded,
    handleNodesDelete,
    handleConnect,
    handleEdgesDelete,
    handleIfConfigSave,
    handleCreateFolderConfigSave,
    closeIfConfig: () => setEditingIfNodeId(null),
    closeCreateFolderConfig: () => setEditingCreateFolderNodeId(null),
  }
}
