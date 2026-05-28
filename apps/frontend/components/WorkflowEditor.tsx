'use client'

import { createPortal } from 'react-dom'
import { ReactFlow, Background, BackgroundVariant } from '@xyflow/react'
import type { FileTreeNode } from '@/lib/types/explore'
import { useWorkflowEditor } from '@/hooks/useWorkflowEditor'
import { NodeConfigContext } from '@/lib/contexts/NodeConfigContext'
import { WorkspaceIndicator } from './WorkspaceIndicator'
import { ViewportControls } from './ViewportControls'
import { IfConfigModal } from './nodes/if_node/IfConfigModal'
import { CreateFolderConfigModal } from './nodes/create_folder_node/CreateFolderConfigModal'
import { WorkflowControls } from './WorkflowControls'

interface WorkflowEditorProps {
  workspacePath: string
  workspaceTree: FileTreeNode
}

export function WorkflowEditor({ workspacePath, workspaceTree }: WorkflowEditorProps) {
  const {
    mounted,
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
    closeIfConfig,
    closeCreateFolderConfig,
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
            <ViewportControls />
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
            {editingCreateFolderNodeId && (
              <CreateFolderConfigModal
                nodeId={editingCreateFolderNodeId}
                workspaceTree={workspaceTree}
                onClose={closeCreateFolderConfig}
                onSave={handleCreateFolderConfigSave}
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
