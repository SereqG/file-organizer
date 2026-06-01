'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNodesState, useEdgesState, addEdge } from '@xyflow/react'
import type { Edge, Connection } from '@xyflow/react'
import type { TriggerId } from '@/components/TriggerSelectModal'
import type { CreateFolderNode as CreateFolderNodeType, DeleteFolderNode as DeleteFolderNodeType, ExecutionFailedNode, IfNode as IfNodeType, RenameFolderNode as RenameFolderNodeType } from '@/lib/types/workflow'
import { useWorkflowDefinition } from '@/hooks/useWorkflowDefinition'
import { TriggerNode } from '@/components/nodes/trigger_node/TriggerNode'
import type { TriggerRFNode } from '@/components/nodes/trigger_node/TriggerNode'
import { IfNode } from '@/components/nodes/if_node/IfNode'
import type { IfRFNode } from '@/components/nodes/if_node/IfNode'
import { CreateFolderNode } from '@/components/nodes/create_folder_node/CreateFolderNode'
import type { CreateFolderRFNode } from '@/components/nodes/create_folder_node/CreateFolderNode'
import { DeleteFolderNode } from '@/components/nodes/delete_folder_node/DeleteFolderNode'
import type { DeleteFolderRFNode } from '@/components/nodes/delete_folder_node/DeleteFolderNode'
import { RenameFolderNode } from '@/components/nodes/rename_folder_node/RenameFolderNode'
import type { RenameFolderRFNode } from '@/components/nodes/rename_folder_node/RenameFolderNode'

export type AppNode = TriggerRFNode | IfRFNode | CreateFolderRFNode | DeleteFolderRFNode | RenameFolderRFNode

const NODE_TYPES = { trigger: TriggerNode, if: IfNode, createFolder: CreateFolderNode, deleteFolder: DeleteFolderNode, renameFolder: RenameFolderNode }

export function useWorkflowEditor() {
  const [mounted, setMounted] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const nodeTypes = useMemo(() => NODE_TYPES, [])
  const dropHandlerRef = useRef<((e: React.DragEvent<HTMLDivElement>) => void) | null>(null)
  const hasTrigger = nodes.some((n) => n.type === 'trigger')
  const [editingIfNodeId, setEditingIfNodeId] = useState<string | null>(null)
  const [editingCreateFolderNodeId, setEditingCreateFolderNodeId] = useState<string | null>(null)
  const [editingDeleteFolderNodeId, setEditingDeleteFolderNodeId] = useState<string | null>(null)
  const [editingRenameFolderNodeId, setEditingRenameFolderNodeId] = useState<string | null>(null)

  const {
    definition,
    addTrigger,
    removeTrigger,
    addGeneralNode,
    removeNode,
    updateIfNodeConfig,
    updateCreateFolderNodeConfig,
    updateDeleteFolderNodeConfig,
    updateRenameFolderNodeConfig,
    addWorkflowEdge,
    removeWorkflowEdge,
  } = useWorkflowDefinition()

  const handleTriggerAdded = useCallback((triggerId: TriggerId, rfNodeId: string) => {
    addTrigger(triggerId, rfNodeId)
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
    openDeleteFolderNodeConfig: (id: string) => setEditingDeleteFolderNodeId(id),
    openRenameFolderNodeConfig: (id: string) => setEditingRenameFolderNodeId(id),
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

  const handleDeleteFolderConfigSave = useCallback((config: DeleteFolderNodeType['config']) => {
    if (!editingDeleteFolderNodeId) return
    setNodes((prev) => prev.map((n) =>
      n.id === editingDeleteFolderNodeId ? { ...n, data: { ...n.data, config } } as AppNode : n
    ))
    updateDeleteFolderNodeConfig(editingDeleteFolderNodeId, config)
  }, [editingDeleteFolderNodeId, setNodes, updateDeleteFolderNodeConfig])

  const handleRenameFolderConfigSave = useCallback((config: RenameFolderNodeType['config']) => {
    if (!editingRenameFolderNodeId) return
    setNodes((prev) => prev.map((n) =>
      n.id === editingRenameFolderNodeId ? { ...n, data: { ...n.data, config } } as AppNode : n
    ))
    updateRenameFolderNodeConfig(editingRenameFolderNodeId, config)
  }, [editingRenameFolderNodeId, setNodes, updateRenameFolderNodeConfig])

  const clearNodeErrors = useCallback(() => {
    setNodes((prev) => prev.map((n) =>
      n.data.executionError ? { ...n, data: { ...n.data, executionError: undefined } } as AppNode : n
    ))
  }, [setNodes])

  const markFailedNodes = useCallback((failedNodes: ExecutionFailedNode[]) => {
    const failedMap = new Map(failedNodes.map((n) => [n.id, n.error]))
    setNodes((prev) => prev.map((n) =>
      failedMap.has(n.id) ? { ...n, data: { ...n.data, executionError: failedMap.get(n.id) } } as AppNode : n
    ))
  }, [setNodes])

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
    editingDeleteFolderNodeId,
    editingRenameFolderNodeId,
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
    handleDeleteFolderConfigSave,
    handleRenameFolderConfigSave,
    clearNodeErrors,
    markFailedNodes,
    closeIfConfig: () => setEditingIfNodeId(null),
    closeCreateFolderConfig: () => setEditingCreateFolderNodeId(null),
    closeDeleteFolderConfig: () => setEditingDeleteFolderNodeId(null),
    closeRenameFolderConfig: () => setEditingRenameFolderNodeId(null),
  }
}
