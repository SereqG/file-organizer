'use client'

import { createPortal } from 'react-dom'
import { ReactFlow, Background, BackgroundVariant } from '@xyflow/react'
import type { FileTreeNode } from '@/lib/types/explore'
import { useWorkflowEditor } from '@/hooks/useWorkflowEditor'
import { NodeConfigContext } from '@/lib/contexts/NodeConfigContext'
import { WorkspaceIndicator } from './WorkspaceIndicator'
import { BottomControls } from './BottomControls'
import { IfConfigModal } from './nodes/if_node/IfConfigModal'
import { SwitchConfigModal } from './nodes/switch_node/SwitchConfigModal'
import { CreateFolderConfigModal } from './nodes/create_folder_node/CreateFolderConfigModal'
import { DeleteFolderConfigModal } from './nodes/delete_folder_node/DeleteFolderConfigModal'
import { RenameFolderConfigModal } from './nodes/rename_folder_node/RenameFolderConfigModal'
import { DeleteFileConfigModal } from './nodes/delete_file_node/DeleteFileConfigModal'
import { RenameFileConfigModal } from './nodes/rename_file_node/RenameFileConfigModal'
import { MoveConfigModal } from './nodes/move_node/MoveConfigModal'
import { CopyConfigModal } from './nodes/copy_node/CopyConfigModal'
import { WorkflowControls } from './WorkflowControls'

interface WorkflowEditorProps {
  workspacePath: string
  workspaceTree: FileTreeNode
}

export function WorkflowEditor({ workspacePath, workspaceTree }: WorkflowEditorProps) {
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
    handleMoveConfigSave,
    handleCopyConfigSave,
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
  } = useWorkflowEditor()

  if (!mounted) return null

  return createPortal(
    <NodeConfigContext.Provider value={nodeConfigValue}>
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
            onRunComplete={markFailedNodes}
            onConfigRemap={applyConfigRemapToCanvas}
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
              workspaceTree={workspaceTree}
              onClose={closeCreateFolderConfig}
              onSave={handleCreateFolderConfigSave}
            />
          )}
          {editingDeleteFolderNodeId && (
            <DeleteFolderConfigModal
              nodeId={editingDeleteFolderNodeId}
              workspaceTree={workspaceTree}
              onClose={closeDeleteFolderConfig}
              onSave={handleDeleteFolderConfigSave}
            />
          )}
          {editingRenameFolderNodeId && (
            <RenameFolderConfigModal
              nodeId={editingRenameFolderNodeId}
              workspaceTree={workspaceTree}
              onClose={closeRenameFolderConfig}
              onSave={handleRenameFolderConfigSave}
            />
          )}
          {editingDeleteFileNodeId && (
            <DeleteFileConfigModal
              nodeId={editingDeleteFileNodeId}
              workspaceTree={workspaceTree}
              onClose={closeDeleteFileConfig}
              onSave={handleDeleteFileConfigSave}
            />
          )}
          {editingRenameFileNodeId && (
            <RenameFileConfigModal
              nodeId={editingRenameFileNodeId}
              workspaceTree={workspaceTree}
              onClose={closeRenameFileConfig}
              onSave={handleRenameFileConfigSave}
            />
          )}
          {editingMoveNodeId && (
            <MoveConfigModal
              nodeId={editingMoveNodeId}
              workspaceTree={workspaceTree}
              onClose={closeMoveConfig}
              onSave={handleMoveConfigSave}
            />
          )}
          {editingCopyNodeId && (
            <CopyConfigModal
              nodeId={editingCopyNodeId}
              workspaceTree={workspaceTree}
              onClose={closeCopyConfig}
              onSave={handleCopyConfigSave}
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
      </div>
    </NodeConfigContext.Provider>,
    document.body
  )
}
