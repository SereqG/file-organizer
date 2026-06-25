'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNodesState, useEdgesState, addEdge } from '@xyflow/react'
import type { Edge, Connection } from '@xyflow/react'
import type { AiClassifierNode as AiClassifierNodeType, ConfigRemap, CopyFileNode as CopyNodeConfigType, CreateFolderNode as CreateFolderNodeType, DeleteFileNode as DeleteFileNodeType, DeleteFolderNode as DeleteFolderNodeType, ExecutionFailedNode, IfNode as IfNodeType, MoveFileNode as MoveNodeConfigType, RenameFileNode as RenameFileNodeType, RenameFolderNode as RenameFolderNodeType, SwitchNode as SwitchNodeType, WorkflowDefinition } from '@/lib/types/workflow'
import { AI_CLASSIFIER_UNCLASSIFIED_HANDLE, SWITCH_DEFAULT_HANDLE } from '@/lib/types/workflow'
import { SWITCH_DEFAULT_COLOR, switchOutputColor } from '@/lib/workflow/utils/switchColors'
import { AI_CLASSIFIER_UNCLASSIFIED_COLOR, aiClassifierOutputColor } from '@/lib/workflow/utils/aiClassifierColors'
import { useWorkflowDefinition } from '@/hooks/useWorkflowDefinition'
import { remapNodeConfig } from '@/lib/workflow/utils/applyConfigRemap'
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
import { MoveNode } from '@/components/nodes/move_node/MoveNode'
import type { MoveRFNode } from '@/components/nodes/move_node/MoveNode'
import { CopyNode } from '@/components/nodes/copy_node/CopyNode'
import type { CopyRFNode } from '@/components/nodes/copy_node/CopyNode'
import { AiClassifierNode } from '@/components/nodes/ai_classifier_node/AiClassifierNode'
import type { AiClassifierRFNode } from '@/components/nodes/ai_classifier_node/AiClassifierNode'

export type AppNode = TriggerRFNode | IfRFNode | SwitchRFNode | CreateFolderRFNode | DeleteFolderRFNode | RenameFolderRFNode | DeleteFileRFNode | RenameFileRFNode | MoveRFNode | CopyRFNode | AiClassifierRFNode

const NODE_TYPES = { trigger: TriggerNode, if: IfNode, switch: SwitchNode, createFolder: CreateFolderNode, deleteFolder: DeleteFolderNode, renameFolder: RenameFolderNode, deleteFile: DeleteFileNode, renameFile: RenameFileNode, moveFile: MoveNode, moveFolder: MoveNode, copyFile: CopyNode, copyFolder: CopyNode, ai_classifier: AiClassifierNode }

function switchEdgeStyle(nodes: AppNode[], connection: Connection): { stroke: string } | undefined {
  const source = nodes.find((n) => n.id === connection.source)
  if (source?.type !== 'switch') return undefined
  const handle = connection.sourceHandle
  if (!handle || handle === SWITCH_DEFAULT_HANDLE) return { stroke: SWITCH_DEFAULT_COLOR }
  const index = (source.data.config?.cases ?? []).findIndex((c) => c.id === handle)
  return { stroke: index >= 0 ? switchOutputColor(index) : SWITCH_DEFAULT_COLOR }
}

function aiClassifierEdgeStyle(nodes: AppNode[], connection: Connection): { stroke: string } | undefined {
  const source = nodes.find((n) => n.id === connection.source)
  if (source?.type !== 'ai_classifier') return undefined
  const handle = connection.sourceHandle
  if (!handle || handle === AI_CLASSIFIER_UNCLASSIFIED_HANDLE) return { stroke: AI_CLASSIFIER_UNCLASSIFIED_COLOR }
  const index = (source.data.config?.categoryIds ?? []).findIndex((id) => id === handle)
  return { stroke: index >= 0 ? aiClassifierOutputColor(index) : AI_CLASSIFIER_UNCLASSIFIED_COLOR }
}

// Fallback positions for any saved node missing one (older saves) — a gentle diagonal cascade so
// nodes never stack exactly on top of each other.
function fallbackPosition(index: number): { x: number; y: number } {
  return { x: 120 + index * 60, y: 120 + index * 90 }
}

/** Rebuild the React Flow nodes for a saved definition: the trigger plus each logical node, with
 * its saved position and config restored. The canvas node `data` mirrors what node-add/config-save
 * produce, so loaded nodes behave identically to ones built by hand. */
function buildCanvasNodes(def: WorkflowDefinition): AppNode[] {
  const trigger: AppNode = {
    id: def.trigger.id,
    type: 'trigger',
    position: def.trigger.position ?? fallbackPosition(0),
    data: { label: def.trigger.name, triggerId: 'manual' },
  } as AppNode

  const nodes = def.nodes.map((node, i) => ({
    id: node.id,
    type: node.type,
    position: node.position ?? fallbackPosition(i + 1),
    data: { label: node.name, config: node.config },
  }) as AppNode)

  return [trigger, ...nodes]
}

export function useWorkflowEditor(initialWorkflow?: WorkflowDefinition) {
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
  const [editingMoveNodeId, setEditingMoveNodeId] = useState<string | null>(null)
  const [editingCopyNodeId, setEditingCopyNodeId] = useState<string | null>(null)
  const [editingAiClassifierNodeId, setEditingAiClassifierNodeId] = useState<string | null>(null)

  const {
    definition,
    lastModifiedAt,
    addTrigger,
    removeTrigger,
    loadDefinition,
    addGeneralNode,
    removeNode,
    updateIfNodeConfig,
    updateSwitchNodeConfig,
    updateCreateFolderNodeConfig,
    updateDeleteFolderNodeConfig,
    updateRenameFolderNodeConfig,
    updateDeleteFileNodeConfig,
    updateRenameFileNodeConfig,
    updateMoveNodeConfig,
    updateCopyNodeConfig,
    updateAiClassifierNodeConfig,
    applyConfigRemap,
    addWorkflowEdge,
    removeWorkflowEdge,
  } = useWorkflowDefinition()

  const handleTriggerAdded = useCallback((rfNodeId: string) => {
    addTrigger(rfNodeId)
  }, [addTrigger])

  // Hydrate the canvas from a saved definition: rebuild the visual nodes/edges (restoring positions
  // and branch-edge colors) and reset the definition so both stay in sync.
  const loadWorkflow = useCallback((def: WorkflowDefinition) => {
    const canvasNodes = buildCanvasNodes(def)
    const canvasEdges: Edge[] = def.edges.map((e) => {
      const connection: Connection = {
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null,
      }
      const style = switchEdgeStyle(canvasNodes, connection) ?? aiClassifierEdgeStyle(canvasNodes, connection)
      return { id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, ...(style ? { style } : {}) }
    })
    setNodes(canvasNodes)
    setEdges(canvasEdges)
    loadDefinition(def)
  }, [setNodes, setEdges, loadDefinition])

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
    const style = switchEdgeStyle(nodes, connection) ?? aiClassifierEdgeStyle(nodes, connection)
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
    openMoveNodeConfig: (id: string) => setEditingMoveNodeId(id),
    openCopyNodeConfig: (id: string) => setEditingCopyNodeId(id),
    openAiClassifierNodeConfig: (id: string) => setEditingAiClassifierNodeId(id),
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

  const handleMoveConfigSave = useCallback((config: MoveNodeConfigType['config']) => {
    if (!editingMoveNodeId) return
    setNodes((prev) => prev.map((n) =>
      n.id === editingMoveNodeId ? { ...n, data: { ...n.data, config } } as AppNode : n
    ))
    updateMoveNodeConfig(editingMoveNodeId, config)
  }, [editingMoveNodeId, setNodes, updateMoveNodeConfig])

  const handleCopyConfigSave = useCallback((config: CopyNodeConfigType['config']) => {
    if (!editingCopyNodeId) return
    setNodes((prev) => prev.map((n) =>
      n.id === editingCopyNodeId ? { ...n, data: { ...n.data, config } } as AppNode : n
    ))
    updateCopyNodeConfig(editingCopyNodeId, config)
  }, [editingCopyNodeId, setNodes, updateCopyNodeConfig])

  const handleAiClassifierConfigSave = useCallback((config: AiClassifierNodeType['config']) => {
    if (!editingAiClassifierNodeId) return
    const nodeId = editingAiClassifierNodeId

    // Prune edges whose source handle is a category that was removed.
    const catIds = new Set(config.categoryIds)
    const staleEdges = edges.filter(
      (e) =>
        e.source === nodeId &&
        e.sourceHandle &&
        e.sourceHandle !== AI_CLASSIFIER_UNCLASSIFIED_HANDLE &&
        !catIds.has(e.sourceHandle),
    )
    if (staleEdges.length > 0) {
      const staleIds = new Set(staleEdges.map((e) => e.id))
      setEdges((prev) => prev.filter((e) => !staleIds.has(e.id)))
      staleEdges.forEach((e) => removeWorkflowEdge(e.id))
    }

    setNodes((prev) => prev.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, config } } as AppNode : n
    ))
    updateAiClassifierNodeConfig(nodeId, config)
  }, [editingAiClassifierNodeId, edges, setEdges, setNodes, removeWorkflowEdge, updateAiClassifierNodeConfig])

  // After a run, apply the backend's path remaps to both the canvas nodes and the definition.
  const applyConfigRemapToCanvas = useCallback((remaps: ConfigRemap[]) => {
    if (remaps.length === 0) return
    setNodes((prev) => prev.map((n) => {
      const config = (n.data as { config?: Record<string, unknown> }).config
      if (!config || !n.type) return n
      return { ...n, data: { ...n.data, config: remapNodeConfig({ type: n.type, config }, remaps) } } as AppNode
    }))
    applyConfigRemap(remaps)
  }, [setNodes, applyConfigRemap])

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
    if (initialWorkflow) loadWorkflow(initialWorkflow)
  // loadWorkflow is stable (useCallback with stable deps); initialWorkflow is intentionally read
  // only once on mount so the canvas is not reset on every render if the parent re-renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    mounted,
    definition,
    lastModifiedAt,
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
    editingMoveNodeId,
    editingCopyNodeId,
    editingAiClassifierNodeId,
    nodeConfigValue,
    onNodesChange,
    onEdgesChange,
    handleTriggerAdded,
    handleGeneralNodeAdded,
    loadWorkflow,
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
    handleMoveConfigSave,
    handleCopyConfigSave,
    handleAiClassifierConfigSave,
    applyConfigRemapToCanvas,
    clearNodeErrors,
    markFailedNodes,
    closeIfConfig: () => setEditingIfNodeId(null),
    closeSwitchConfig: () => setEditingSwitchNodeId(null),
    closeCreateFolderConfig: () => setEditingCreateFolderNodeId(null),
    closeDeleteFolderConfig: () => setEditingDeleteFolderNodeId(null),
    closeRenameFolderConfig: () => setEditingRenameFolderNodeId(null),
    closeDeleteFileConfig: () => setEditingDeleteFileNodeId(null),
    closeRenameFileConfig: () => setEditingRenameFileNodeId(null),
    closeMoveConfig: () => setEditingMoveNodeId(null),
    closeCopyConfig: () => setEditingCopyNodeId(null),
    closeAiClassifierConfig: () => setEditingAiClassifierNodeId(null),
  }
}
