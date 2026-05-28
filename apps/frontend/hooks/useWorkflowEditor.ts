'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNodesState, useEdgesState, addEdge } from '@xyflow/react'
import type { Node, Edge, Connection } from '@xyflow/react'
import type { TriggerId } from '@/components/TriggerSelectModal'
import type { CreateFolderNode as CreateFolderNodeType, IfNode as IfNodeType } from '@/lib/types/workflow'
import { useWorkflowDefinition } from '@/hooks/useWorkflowDefinition'
import { TriggerNode } from '@/components/nodes/trigger_node/TriggerNode'
import { IfNode } from '@/components/nodes/if_node/IfNode'
import { CreateFolderNode } from '@/components/nodes/create_folder_node/CreateFolderNode'

const NODE_TYPES = { trigger: TriggerNode, if: IfNode, createFolder: CreateFolderNode }

export function useWorkflowEditor() {
  const [mounted, setMounted] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const nodeTypes = useMemo(() => NODE_TYPES, [])
  const dropHandlerRef = useRef<((e: React.DragEvent<HTMLDivElement>) => void) | null>(null)
  const hasTrigger = nodes.some((n) => n.type === 'trigger')
  const [editingIfNodeId, setEditingIfNodeId] = useState<string | null>(null)
  const [editingCreateFolderNodeId, setEditingCreateFolderNodeId] = useState<string | null>(null)

  const {
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

  const handleNodesDelete = useCallback((deleted: Node[]) => {
    for (const node of deleted) {
      if (node.type === 'trigger') {
        removeTrigger()
      } else {
        removeNode(node.id)
      }
    }
  }, [removeTrigger, removeNode])

  const handleConnect = useCallback((connection: Connection) => {
    setEdges((prev) => addEdge(connection, prev))
    addWorkflowEdge(connection)
  }, [setEdges, addWorkflowEdge])

  const handleEdgesDelete = useCallback((deleted: Edge[]) => {
    for (const edge of deleted) {
      removeWorkflowEdge(edge.id)
    }
  }, [removeWorkflowEdge])

  const ifNodeConfigValue = useMemo(() => ({
    openConfig: (id: string) => setEditingIfNodeId(id),
  }), [])

  const createFolderNodeConfigValue = useMemo(() => ({
    openConfig: (id: string) => setEditingCreateFolderNodeId(id),
  }), [])

  const handleIfConfigSave = useCallback((config: IfNodeType['config']) => {
    if (!editingIfNodeId) return
    setNodes((prev) => prev.map((n) =>
      n.id === editingIfNodeId ? { ...n, data: { ...n.data, config } } : n
    ))
    updateIfNodeConfig(editingIfNodeId, config)
  }, [editingIfNodeId, setNodes, updateIfNodeConfig])

  const handleCreateFolderConfigSave = useCallback((config: CreateFolderNodeType['config']) => {
    if (!editingCreateFolderNodeId) return
    setNodes((prev) => prev.map((n) =>
      n.id === editingCreateFolderNodeId ? { ...n, data: { ...n.data, config } } : n
    ))
    updateCreateFolderNodeConfig(editingCreateFolderNodeId, config)
  }, [editingCreateFolderNodeId, setNodes, updateCreateFolderNodeConfig])

  useEffect(() => {
    setMounted(true)
  }, [])

  return {
    mounted,
    nodes,
    edges,
    nodeTypes,
    dropHandlerRef,
    hasTrigger,
    editingIfNodeId,
    editingCreateFolderNodeId,
    ifNodeConfigValue,
    createFolderNodeConfigValue,
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
