'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ReactFlow, Background, BackgroundVariant, useNodesState, useReactFlow } from '@xyflow/react'
import type { Node, OnNodesChange } from '@xyflow/react'
import type { FileTreeNode } from '@/lib/types/explore'
import { WorkspaceIndicator } from './WorkspaceIndicator'
import { ViewportControls } from './ViewportControls'
import { NodesSidebar } from './NodesSidebar'
import { AddTriggerButton } from './AddTriggerButton'
import { TriggerSelectModal } from './TriggerSelectModal'
import type { TriggerId } from './TriggerSelectModal'
import { TriggerNode } from './TriggerNode'

const NODE_TYPES = { trigger: TriggerNode }

const TRIGGER_LABELS: Record<TriggerId, string> = {
  manual: 'Manual Trigger',
  schedule: 'Schedule',
}

interface WorkflowControlsProps {
  hasTrigger: boolean
  onNodesChange: OnNodesChange<Node>
  dropHandlerRef: React.MutableRefObject<((e: React.DragEvent<HTMLDivElement>) => void) | null>
}

function WorkflowControls({ hasTrigger, onNodesChange, dropHandlerRef }: WorkflowControlsProps) {
  const { screenToFlowPosition } = useReactFlow()
  const [modalOpen, setModalOpen] = useState(false)

  const addNode = useCallback((triggerId: TriggerId, label: string, clientPos?: { x: number; y: number }) => {
    if (hasTrigger) return
    const screenPos = clientPos ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const position = screenToFlowPosition(screenPos)
    const newNode: Node = {
      id: `trigger-${Date.now()}`,
      type: 'trigger',
      position,
      data: { label, triggerId },
    }
    onNodesChange([{ type: 'add', item: newNode }])
  }, [hasTrigger, screenToFlowPosition, onNodesChange])

  useEffect(() => {
    dropHandlerRef.current = (event: React.DragEvent<HTMLDivElement>) => {
      const raw = event.dataTransfer.getData('application/node')
      if (!raw) return
      const { triggerId, label } = JSON.parse(raw) as { triggerId: TriggerId; label: string }
      addNode(triggerId, label, { x: event.clientX, y: event.clientY })
    }
  }, [addNode, dropHandlerRef])

  return (
    <>
      <NodesSidebar
        onAddNode={(triggerId, label) => addNode(triggerId as TriggerId, label)}
        triggerDisabled={hasTrigger}
      />
      {!hasTrigger && <AddTriggerButton onClick={() => setModalOpen(true)} />}
      {modalOpen && (
        <TriggerSelectModal
          onSelect={(id) => { addNode(id, TRIGGER_LABELS[id]); setModalOpen(false) }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}

interface WorkflowEditorProps {
  workspacePath: string
  workspaceTree: FileTreeNode
}

export function WorkflowEditor({ workspacePath, workspaceTree }: WorkflowEditorProps) {
  const [mounted, setMounted] = useState(false)
  const [nodes, , onNodesChange] = useNodesState<Node>([])
  const nodeTypes = useMemo(() => NODE_TYPES, [])
  const dropHandlerRef = useRef<((e: React.DragEvent<HTMLDivElement>) => void) | null>(null)
  const hasTrigger = nodes.some((n) => n.type === 'trigger')

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0">
      <WorkspaceIndicator path={workspacePath} tree={workspaceTree} />
      <ReactFlow
        className="w-full h-full"
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        nodeOrigin={[0.5, 0.5]}
        nodesDraggable
        nodesConnectable={false}
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
        <WorkflowControls hasTrigger={hasTrigger} onNodesChange={onNodesChange} dropHandlerRef={dropHandlerRef} />
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
    </div>,
    document.body
  )
}
