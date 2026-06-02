'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNodesState, useEdgesState, addEdge } from '@xyflow/react'
import type { Edge, Connection } from '@xyflow/react'
import type { TriggerId } from '@/components/TriggerSelectModal'
import type { CreateFolderNode as CreateFolderNodeType, DeleteFileNode as DeleteFileNodeType, DeleteFolderNode as DeleteFolderNodeType, ExecutionFailedNode, IfNode as IfNodeType, RenameFileNode as RenameFileNodeType, RenameFolderNode as RenameFolderNodeType, SwitchNode as SwitchNodeType } from '@/lib/types/workflow'
import { SWITCH_DEFAULT_HANDLE } from '@/lib/types/workflow'
import { SWITCH_DEFAULT_COLOR, switchOutputColor } from '@/lib/workflow/utils/switchColors'
import { useWorkflowDefinition } from '@/hooks/useWorkflowDefinition'
import { TriggerNode } from '@/components/nodes/trigger_node/TriggerNode'
import type { TriggerRFNode } from '@/components/nodes/trigger_node/TriggerNode'
import { IfNode } from '@/components/nodes/if_node/IfNode'
import type { IfRFNode } from '@/components/nodes/if_node/IfNode'
import { SwitchNode } from '@/components/nodes/switch_node/SwitchNode'
import type { SwitchRFNode } from '@/components/nodes/switch_node/SwitchNode'
import { CreateFolderNode } from '@/components/nodes/create_folder_node/CreateFolderNode'
import type { CreateFolderRFNode } from '@/components/nodes/create_folder_node/CreateFolderNode'
import { DeleteFolderNode } from '@/components/nodes/delete_folder_node/DeleteFolderNode'
import type { DeleteFolderRFNode } from '@/components/nodes/delete_folder_node/DeleteFolderNode'
import { RenameFolderNode } from '@/components/nodes/rename_folder_node/RenameFolderNode'
import type { RenameFolderRFNode } from '@/components/nodes/rename_folder_node/RenameFolderNode'
import { DeleteFileNode } from '@/components/nodes/delete_file_node/DeleteFileNode'
import type { DeleteFileRFNode } from '@/components/nodes/delete_file_node/DeleteFileNode'
import { RenameFileNode } from '@/components/nodes/rename_file_node/RenameFileNode'
import type { RenameFileRFNode } from '@/components/nodes/rename_file_node/RenameFileNode'

export type AppNode = TriggerRFNode | IfRFNode | SwitchRFNode | CreateFolderRFNode | DeleteFolderRFNode | RenameFolderRFNode | DeleteFileRFNode | RenameFileRFNode

const NODE_TYPES = { trigger: TriggerNode, if: IfNode, switch: SwitchNode, createFolder: CreateFolderNode, deleteFolder: DeleteFolderNode, renameFolder: RenameFolderNode, deleteFile: DeleteFileNode, renameFile: RenameFileNode }

// Color the edge leaving a switch output so the trace matches its handle. Returns undefined for
// non-switch sources (default React Flow styling).
function switchEdgeStyle(nodes: AppNode[], connection: Connection): { stroke: string } | undefined {
  const source = nodes.find((n) => n.id === connection.source)
  if (source?.type !== 'switch') return undefined
  const handle = connection.sourceHandle
  if (!handle || handle === SWITCH_DEFAULT_HANDLE) return { stroke: SWITCH_DEFAULT_COLOR }
  const index = (source.data.config?.cases ?? []).findIndex((c) => c.id === handle)
  return { stroke: index >= 0 ? switchOutputColor(index) : SWITCH_DEFAULT_COLOR }
}

export function useWorkflowEditor() {
  const [mounted, setMounted] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const nodeTypes = useMemo(() => NODE_TYPES, [])
  const dropHandlerRef = useRef<((e: React.DragEvent<HTMLDivElement>) => void) | null>(null)
  const hasTrigger = nodes.some((n) => n.type === 'trigger')
  const [editingIfNodeId, setEditingIfNodeId] = useState<string | null>(null)
  const [editingSwitchNodeId, setEditingSwitchNodeId] = useState<string | null>(null)
  const [editingCreateFolderNodeId, setEditingCreateFolderNodeId] = useState<string | null>(null)
  const [editingDeleteFolderNodeId, setEditingDeleteFolderNodeId] = useState<string | null>(null)
  const [editingRenameFolderNodeId, setEditingRenameFolderNodeId] = useState<string | null>(null)
  const [editingDeleteFileNodeId, setEditingDeleteFileNodeId] = useState<string | null>(null)
  const [editingRenameFileNodeId, setEditingRenameFileNodeId] = useState<string | null>(null)

  const {
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
    updateDeleteFileNodeConfig,
    updateRenameFileNodeConfig,
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
    const style = switchEdgeStyle(nodes, connection)
    setEdges((prev) => addEdge({ ...connection, id: edgeId, ...(style ? { style } : {}) }, prev))
    addWorkflowEdge(connection)
  }, [nodes, setEdges, addWorkflowEdge])

  const handleEdgesDelete = useCallback((deleted: Edge[]) => {
    for (const edge of deleted) {
      removeWorkflowEdge(edge.id)
    }
  }, [removeWorkflowEdge])

  const nodeConfigValue = useMemo(() => ({
    openIfNodeConfig: (id: string) => setEditingIfNodeId(id),
    openSwitchNodeConfig: (id: string) => setEditingSwitchNodeId(id),
    openCreateFolderNodeConfig: (id: string) => setEditingCreateFolderNodeId(id),
    openDeleteFolderNodeConfig: (id: string) => setEditingDeleteFolderNodeId(id),
    openRenameFolderNodeConfig: (id: string) => setEditingRenameFolderNodeId(id),
    openDeleteFileNodeConfig: (id: string) => setEditingDeleteFileNodeId(id),
    openRenameFileNodeConfig: (id: string) => setEditingRenameFileNodeId(id),
  }), [])

  const handleIfConfigSave = useCallback((config: IfNodeType['config']) => {
    if (!editingIfNodeId) return
    setNodes((prev) => prev.map((n) =>
      n.id === editingIfNodeId ? { ...n, data: { ...n.data, config } } as AppNode : n
    ))
    updateIfNodeConfig(editingIfNodeId, config)
  }, [editingIfNodeId, setNodes, updateIfNodeConfig])

  const handleSwitchConfigSave = useCallback((config: SwitchNodeType['config']) => {
    if (!editingSwitchNodeId) return
    const nodeId = editingSwitchNodeId

    // Removing an output orphans any edge wired to its handle. Prune those traces from both the
    // canvas and the definition so no dangling colored edge remains. (The "default" handle and
    // unconnected outputs are always preserved.)
    const caseIds = new Set(config.cases.map((c) => c.id))
    const staleEdges = edges.filter(
      (e) => e.source === nodeId && e.sourceHandle && e.sourceHandle !== SWITCH_DEFAULT_HANDLE && !caseIds.has(e.sourceHandle),
    )
    if (staleEdges.length > 0) {
      const staleIds = new Set(staleEdges.map((e) => e.id))
      setEdges((prev) => prev.filter((e) => !staleIds.has(e.id)))
      staleEdges.forEach((e) => removeWorkflowEdge(e.id))
    }

    setNodes((prev) => prev.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, config } } as AppNode : n
    ))
    updateSwitchNodeConfig(nodeId, config)
  }, [editingSwitchNodeId, edges, setEdges, setNodes, removeWorkflowEdge, updateSwitchNodeConfig])

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

  const handleDeleteFileConfigSave = useCallback((config: DeleteFileNodeType['config']) => {
    if (!editingDeleteFileNodeId) return
    setNodes((prev) => prev.map((n) =>
      n.id === editingDeleteFileNodeId ? { ...n, data: { ...n.data, config } } as AppNode : n
    ))
    updateDeleteFileNodeConfig(editingDeleteFileNodeId, config)
  }, [editingDeleteFileNodeId, setNodes, updateDeleteFileNodeConfig])

  const handleRenameFileConfigSave = useCallback((config: RenameFileNodeType['config']) => {
    if (!editingRenameFileNodeId) return
    setNodes((prev) => prev.map((n) =>
      n.id === editingRenameFileNodeId ? { ...n, data: { ...n.data, config } } as AppNode : n
    ))
    updateRenameFileNodeConfig(editingRenameFileNodeId, config)
  }, [editingRenameFileNodeId, setNodes, updateRenameFileNodeConfig])

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
    editingSwitchNodeId,
    editingCreateFolderNodeId,
    editingDeleteFolderNodeId,
    editingRenameFolderNodeId,
    editingDeleteFileNodeId,
    editingRenameFileNodeId,
    nodeConfigValue,
    onNodesChange,
    onEdgesChange,
    handleTriggerAdded,
    handleGeneralNodeAdded,
    handleNodesDelete,
    handleConnect,
    handleEdgesDelete,
    handleIfConfigSave,
    handleSwitchConfigSave,
    handleCreateFolderConfigSave,
    handleDeleteFolderConfigSave,
    handleRenameFolderConfigSave,
    handleDeleteFileConfigSave,
    handleRenameFileConfigSave,
    clearNodeErrors,
    markFailedNodes,
    closeIfConfig: () => setEditingIfNodeId(null),
    closeSwitchConfig: () => setEditingSwitchNodeId(null),
    closeCreateFolderConfig: () => setEditingCreateFolderNodeId(null),
    closeDeleteFolderConfig: () => setEditingDeleteFolderNodeId(null),
    closeRenameFolderConfig: () => setEditingRenameFolderNodeId(null),
    closeDeleteFileConfig: () => setEditingDeleteFileNodeId(null),
    closeRenameFileConfig: () => setEditingRenameFileNodeId(null),
  }
}
