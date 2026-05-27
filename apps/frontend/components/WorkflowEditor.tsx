'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ReactFlow, Background, BackgroundVariant, useNodesState, useEdgesState, addEdge } from '@xyflow/react'
import type { Node, Edge, Connection } from '@xyflow/react'
import type { FileTreeNode } from '@/lib/types/explore'
import type { TriggerId } from './TriggerSelectModal'
import type { IfNode as IfNodeType } from '@/lib/types/workflow'
import { useWorkflowDefinition } from '@/hooks/useWorkflowDefinition'
import { IfNodeConfigContext } from '@/lib/contexts/IfNodeConfigContext'
import { WorkspaceIndicator } from './WorkspaceIndicator'
import { ViewportControls } from './ViewportControls'
import { TriggerNode } from './TriggerNode'
import { IfNode } from './IfNode'
import { IfConfigModal } from './IfConfigModal'
import { WorkflowControls } from './WorkflowControls'

const NODE_TYPES = { trigger: TriggerNode, if: IfNode }

interface WorkflowEditorProps {
  workspacePath: string
  workspaceTree: FileTreeNode
}

export function WorkflowEditor({ workspacePath, workspaceTree }: WorkflowEditorProps) {
  const [mounted, setMounted] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const nodeTypes = useMemo(() => NODE_TYPES, [])
  const dropHandlerRef = useRef<((e: React.DragEvent<HTMLDivElement>) => void) | null>(null)
  const hasTrigger = nodes.some((n) => n.type === 'trigger')
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)

  const { addTrigger, removeTrigger, addGeneralNode, removeNode, updateIfNodeConfig, addWorkflowEdge, removeWorkflowEdge } = useWorkflowDefinition()

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
    openConfig: (id: string) => setEditingNodeId(id),
  }), [])

  const handleConfigSave = useCallback((config: IfNodeType['config']) => {
    if (!editingNodeId) return
    setNodes((prev) => prev.map((n) =>
      n.id === editingNodeId ? { ...n, data: { ...n.data, config } } : n
    ))
    updateIfNodeConfig(editingNodeId, config)
  }, [editingNodeId, setNodes, updateIfNodeConfig])

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <IfNodeConfigContext.Provider value={ifNodeConfigValue}>
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
          {editingNodeId && (
            <IfConfigModal
              nodeId={editingNodeId}
              onClose={() => setEditingNodeId(null)}
              onSave={handleConfigSave}
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
    </IfNodeConfigContext.Provider>,
    document.body
  )
}
