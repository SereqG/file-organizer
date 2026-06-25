'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ReactFlow, Background, BackgroundVariant } from '@xyflow/react'
import type { FileTreeNode } from '@/lib/types/explore'
import type { ExecutionFailedNode, WorkflowDefinition, WorkflowNode, WorkflowTriggerNode } from '@/lib/types/workflow'
import { useWorkflowEditor } from '@/hooks/useWorkflowEditor'
import { useExploreJob } from '@/hooks/useExploreJob'
import { useWorkflowSimulation } from '@/hooks/useWorkflowSimulation'
import type { NodeSimulationResult } from '@/lib/types/workflow'
import { NodeConfigContext } from '@/lib/contexts/NodeConfigContext'
import { SimulationContext } from '@/lib/contexts/SimulationContext'
import { WorkflowRunContext } from '@/lib/contexts/WorkflowRunContext'
import type { WorkflowRunState } from '@/lib/contexts/WorkflowRunContext'
import { CategoryLibraryProvider } from '@/lib/workflow/stores/categoryLibrary'
import { WorkspaceIndicator } from './WorkspaceIndicator'
import { BottomControls } from './BottomControls'
import { DepthConfirmModal } from './DepthConfirmModal'
import { LogsPanelButton } from './LogsPanelButton'
import { LogsPanel } from './LogsPanel'
import { WorkflowLibraryButton } from './WorkflowLibraryButton'
import { WorkflowLibraryPanel } from './WorkflowLibraryPanel'
import { IfConfigModal } from './nodes/if_node/IfConfigModal'
import { SwitchConfigModal } from './nodes/switch_node/SwitchConfigModal'
import { CreateFolderConfigModal } from './nodes/create_folder_node/CreateFolderConfigModal'
import { DeleteFolderConfigModal } from './nodes/delete_folder_node/DeleteFolderConfigModal'
import { RenameFolderConfigModal } from './nodes/rename_folder_node/RenameFolderConfigModal'
import { DeleteFileConfigModal } from './nodes/delete_file_node/DeleteFileConfigModal'
import { RenameFileConfigModal } from './nodes/rename_file_node/RenameFileConfigModal'
import { MoveConfigModal } from './nodes/move_node/MoveConfigModal'
import { CopyConfigModal } from './nodes/copy_node/CopyConfigModal'
import { AiClassifierConfigModal } from './nodes/ai_classifier_node/AiClassifierConfigModal'
import { WorkflowControls } from './WorkflowControls'
import { ProjectInfoModal } from './ProjectInfoModal'

interface WorkflowEditorProps {
  workspacePath: string
  workspaceTree: FileTreeNode
  onTreeRefresh: (tree: FileTreeNode) => void
}

export function WorkflowEditor({ workspacePath, workspaceTree, onTreeRefresh }: WorkflowEditorProps) {
  const [runState, setRunStateRaw] = useState<WorkflowRunState>({ isRunning: false, currentNodeId: null, logEntries: [] })
  const [hasRun, setHasRun] = useState(false)
  const [logsPanelOpen, setLogsPanelOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  const setRunState = useCallback((patch: Partial<WorkflowRunState>) => {
    setRunStateRaw((s) => ({ ...s, ...patch }))
    if (patch.isRunning) {
      setHasRun(true)
      setLogsPanelOpen(true)
    }
  }, [])

  const runContextValue = { ...runState, hasRun, setRunState }

  const { state: exploreState, startExplore, acceptPartialTree } = useExploreJob({ autoStart: false, rootPath: workspacePath })

  const isExploring = exploreState.phase === 'loading' || exploreState.phase === 'awaiting_confirmation'

  useEffect(() => {
    if (exploreState.phase !== 'complete') return
    onTreeRefresh(exploreState.tree)
  }, [exploreState, onTreeRefresh])

  const {
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
    closeIfConfig,
    closeSwitchConfig,
    closeCreateFolderConfig,
    closeDeleteFolderConfig,
    closeRenameFolderConfig,
    closeDeleteFileConfig,
    closeRenameFileConfig,
    closeMoveConfig,
    closeCopyConfig,
    closeAiClassifierConfig,
  } = useWorkflowEditor()

  const handleRunComplete = useCallback((failedNodes: ExecutionFailedNode[]) => {
    markFailedNodes(failedNodes)
    startExplore(false)
  }, [markFailedNodes, startExplore])

  // Serialize the current canvas for saving: the logical definition with each node's live React
  // Flow position merged in, so a reload restores the layout. Null when there is nothing to save.
  const buildSaveDefinition = useCallback((): WorkflowDefinition | null => {
    if (!definition) return null
    const positionById = new Map(nodes.map((n) => [n.id, n.position]))
    return {
      ...definition,
      trigger: { ...definition.trigger, position: positionById.get(definition.trigger.id) ?? definition.trigger.position } as WorkflowTriggerNode,
      nodes: definition.nodes.map((n) => ({ ...n, position: positionById.get(n.id) ?? n.position }) as WorkflowNode),
    }
  }, [definition, nodes])

  // Per-node predicted tree for the path-picker config modals. When a path-consuming modal is open,
  // simulate the workflow up to that node so its pickers preview upstream creates/moves/deletes.
  const { simulateNode, simulateNodeForced } = useWorkflowSimulation(definition, workspacePath)
  const editingPathNodeId =
    editingCreateFolderNodeId ?? editingDeleteFolderNodeId ?? editingRenameFolderNodeId ??
    editingDeleteFileNodeId ?? editingRenameFileNodeId ?? editingMoveNodeId ?? editingCopyNodeId ?? null
  const [simLoading, setSimLoading] = useState(false)
  const [simResult, setSimResult] = useState<NodeSimulationResult | null>(null)

  useEffect(() => {
    if (!editingPathNodeId) return
    let active = true
    const run = async () => {
      setSimLoading(true)
      setSimResult(null)
      const result = await simulateNode(editingPathNodeId)
      if (active) {
        setSimResult(result)
        setSimLoading(false)
      }
    }
    void run()
    return () => { active = false }
  }, [editingPathNodeId, simulateNode])

  const onResimulate = useCallback(async () => {
    if (!editingPathNodeId) return
    setSimLoading(true)
    setSimResult(null)
    const result = await simulateNodeForced(editingPathNodeId)
    setSimResult(result)
    setSimLoading(false)
  }, [editingPathNodeId, simulateNodeForced])

  const simContextValue = useMemo(
    () => ({ simLoading, onResimulate }),
    [simLoading, onResimulate],
  )

  // Use the predicted tree when the node was reachable and produced one; otherwise fall back to the
  // real scan (and surface a banner so the user knows why).
  const treeForModal = simResult?.ok && simResult.tree ? simResult.tree : workspaceTree
  const showFallbackBanner = !!editingPathNodeId && !simLoading && !(simResult?.ok && simResult.tree)

  if (!mounted) return null

  return createPortal(
    <CategoryLibraryProvider>
    <WorkflowRunContext.Provider value={runContextValue}>
    <NodeConfigContext.Provider value={nodeConfigValue}>
    <SimulationContext.Provider value={simContextValue}>
      <div className="fixed inset-0">
          <WorkspaceIndicator path={workspacePath} tree={workspaceTree} />
          <ReactFlow
            className="w-full h-full"
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodesDelete={handleNodesDelete}
            onEdgesChange={onEdgesChange}
            onEdgesDelete={handleEdgesDelete}
            onConnect={handleConnect}
            defaultEdgeOptions={{ type: 'smoothstep' }}
            deleteKeyCode={['Backspace', 'Delete']}
            nodeOrigin={[0.5, 0.5]}
            nodesDraggable
            nodesConnectable={true}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            onDrop={(e) => { e.preventDefault(); dropHandlerRef.current?.(e) }}
            onDragOver={(e) => e.preventDefault()}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={32}
              size={1.5}
              color="rgba(255, 255, 255, 0.4)"
              bgColor="#080808"
            />
            <BottomControls
              definition={definition}
              rootPath={workspacePath}
              onRunStart={clearNodeErrors}
              onRunComplete={handleRunComplete}
              onConfigRemap={applyConfigRemapToCanvas}
              onReexplore={() => startExplore(false)}
              onShowInfo={() => setInfoOpen(true)}
              isExploring={isExploring}
            />
            <WorkflowControls
              hasTrigger={hasTrigger}
              onNodesChange={onNodesChange}
              onTriggerAdded={handleTriggerAdded}
              onGeneralNodeAdded={handleGeneralNodeAdded}
              dropHandlerRef={dropHandlerRef}
            />
            {editingIfNodeId && (
              <IfConfigModal
                nodeId={editingIfNodeId}
                onClose={closeIfConfig}
                onSave={handleIfConfigSave}
              />
            )}
            {editingSwitchNodeId && (
              <SwitchConfigModal
                nodeId={editingSwitchNodeId}
                onClose={closeSwitchConfig}
                onSave={handleSwitchConfigSave}
              />
            )}
            {editingCreateFolderNodeId && (
              <CreateFolderConfigModal
                nodeId={editingCreateFolderNodeId}
                workspaceTree={treeForModal}
                onClose={closeCreateFolderConfig}
                onSave={handleCreateFolderConfigSave}
              />
            )}
            {editingDeleteFolderNodeId && (
              <DeleteFolderConfigModal
                nodeId={editingDeleteFolderNodeId}
                workspaceTree={treeForModal}
                onClose={closeDeleteFolderConfig}
                onSave={handleDeleteFolderConfigSave}
              />
            )}
            {editingRenameFolderNodeId && (
              <RenameFolderConfigModal
                nodeId={editingRenameFolderNodeId}
                workspaceTree={treeForModal}
                onClose={closeRenameFolderConfig}
                onSave={handleRenameFolderConfigSave}
              />
            )}
            {editingDeleteFileNodeId && (
              <DeleteFileConfigModal
                nodeId={editingDeleteFileNodeId}
                workspaceTree={treeForModal}
                onClose={closeDeleteFileConfig}
                onSave={handleDeleteFileConfigSave}
              />
            )}
            {editingRenameFileNodeId && (
              <RenameFileConfigModal
                nodeId={editingRenameFileNodeId}
                workspaceTree={treeForModal}
                onClose={closeRenameFileConfig}
                onSave={handleRenameFileConfigSave}
              />
            )}
            {editingMoveNodeId && (
              <MoveConfigModal
                nodeId={editingMoveNodeId}
                workspaceTree={treeForModal}
                onClose={closeMoveConfig}
                onSave={handleMoveConfigSave}
              />
            )}
            {editingCopyNodeId && (
              <CopyConfigModal
                nodeId={editingCopyNodeId}
                workspaceTree={treeForModal}
                onClose={closeCopyConfig}
                onSave={handleCopyConfigSave}
              />
            )}
            {editingAiClassifierNodeId && (
              <AiClassifierConfigModal
                nodeId={editingAiClassifierNodeId}
                onClose={closeAiClassifierConfig}
                onSave={handleAiClassifierConfigSave}
              />
            )}
          </ReactFlow>

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: [
                'radial-gradient(ellipse 60% 30% at 50% 0%,   rgba(249,115,22,0.18) 0%, transparent 100%)',
                'radial-gradient(ellipse 60% 30% at 50% 100%, rgba(249,115,22,0.18) 0%, transparent 100%)',
                'radial-gradient(ellipse 30% 60% at 0%   50%, rgba(249,115,22,0.14) 0%, transparent 100%)',
                'radial-gradient(ellipse 30% 60% at 100% 50%, rgba(249,115,22,0.14) 0%, transparent 100%)',
              ].join(', '),
            }}
          />

          {exploreState.phase === 'loading' && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/80 px-6 py-4">
                <span className="size-4 rounded-full border-2 border-white/10 border-t-orange-400/60 animate-spin" />
                <span className="text-sm text-white/70">File system exploration, please wait...</span>
              </div>
            </div>
          )}

          {exploreState.phase === 'awaiting_confirmation' && (
            <DepthConfirmModal
              detectedDepth={exploreState.detectedDepth}
              directoryName={exploreState.directoryName}
              onConfirm={() => startExplore(true)}
              onCancel={() => acceptPartialTree(exploreState.partialTree)}
            />
          )}

          {editingPathNodeId && simLoading && (
            <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-lg border border-white/10 bg-black/85 px-4 py-2 text-xs text-white/70 shadow-xl flex items-center gap-2">
              <span className="size-3 rounded-full border-2 border-white/10 border-t-orange-400/70 animate-spin" />
              Simulating upstream changes…
            </div>
          )}
          {showFallbackBanner && (
            <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 max-w-md rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200/90 shadow-xl">
              Showing the current filesystem. Connect and configure this node&apos;s upstream chain to preview their changes here.
              {simResult?.error && <span className="block text-amber-200/60 mt-0.5">{simResult.error}</span>}
            </div>
          )}

          <LogsPanelButton panelOpen={logsPanelOpen} onToggle={() => setLogsPanelOpen((o) => !o)} />
          {logsPanelOpen && <LogsPanel onClose={() => setLogsPanelOpen(false)} />}

          {!libraryOpen && <WorkflowLibraryButton onToggle={() => setLibraryOpen(true)} />}
          {libraryOpen && (
            <WorkflowLibraryPanel
              onClose={() => setLibraryOpen(false)}
              canSave={!!definition}
              buildSaveDefinition={buildSaveDefinition}
              onApplyDefinition={loadWorkflow}
            />
          )}

          {infoOpen && <ProjectInfoModal onClose={() => setInfoOpen(false)} />}
        </div>
    </SimulationContext.Provider>
    </NodeConfigContext.Provider>
    </WorkflowRunContext.Provider>
    </CategoryLibraryProvider>,
    document.body
  )
}
