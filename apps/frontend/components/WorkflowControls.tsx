'use client'

import { useCallback, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { OnNodesChange } from '@xyflow/react'
import type { AppNode } from '@/hooks/useWorkflowEditor'
import { NodesSidebar } from './nodes/nodes_sidebar/NodesSidebar'
import { AddTriggerButton } from './AddTriggerButton'
import type { NodeDescriptor } from '@/lib/types/workflowNodeDescriptor'
import { decodeDragPayload, NODE_DRAG_TYPE } from './nodes/nodes_sidebar/dragPayload'
import { initialSwitchCases } from '@/hooks/useWorkflowDefinition'

function buildGeneralNode(id: string, entry: NodeDescriptor, position: { x: number; y: number }): AppNode | null {
  switch (entry.nodeType) {
    case 'if':
      return { id, type: 'if', position, data: { label: entry.label, config: { conditions: { id: `group-${Date.now()}`, operator: 'AND' as const, children: [] } } } }
    case 'switch':
      return { id, type: 'switch', position, data: { label: entry.label, config: { cases: initialSwitchCases(id) } } }
    case 'createFolder':
      return { id, type: 'createFolder', position, data: { label: entry.label } }
    case 'deleteFolder':
      return { id, type: 'deleteFolder', position, data: { label: entry.label } }
    case 'renameFolder':
      return { id, type: 'renameFolder', position, data: { label: entry.label } }
    case 'deleteFile':
      return { id, type: 'deleteFile', position, data: { label: entry.label } }
    case 'renameFile':
      return { id, type: 'renameFile', position, data: { label: entry.label } }
    case 'moveFile':
      return { id, type: 'moveFile', position, data: { label: entry.label } }
    case 'moveFolder':
      return { id, type: 'moveFolder', position, data: { label: entry.label } }
    case 'copyFile':
      return { id, type: 'copyFile', position, data: { label: entry.label } }
    case 'copyFolder':
      return { id, type: 'copyFolder', position, data: { label: entry.label } }
    case 'ai_classifier':
      return { id, type: 'ai_classifier', position, data: { label: entry.label } }
    default:
      return null
  }
}

interface WorkflowControlsProps {
  hasTrigger: boolean
  onNodesChange: OnNodesChange<AppNode>
  onTriggerAdded: (rfNodeId: string) => void
  onGeneralNodeAdded: (id: string, nodeType: string, label: string) => void
  dropHandlerRef: React.MutableRefObject<((e: React.DragEvent<HTMLDivElement>) => void) | null>
}

export function WorkflowControls({ hasTrigger, onNodesChange, onTriggerAdded, onGeneralNodeAdded, dropHandlerRef }: WorkflowControlsProps) {
  const { screenToFlowPosition } = useReactFlow()

  const addNode = useCallback((entry: NodeDescriptor, clientPos?: { x: number; y: number }) => {
    const screenPos = clientPos ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const position = screenToFlowPosition(screenPos)

    if (entry.kind === 'trigger') {
      if (hasTrigger) return
      const newNode: AppNode = {
        id: `trigger-${Date.now()}`,
        type: 'trigger',
        position,
        data: { label: entry.label, triggerId: 'manual' },
      }
      onNodesChange([{ type: 'add', item: newNode }])
      onTriggerAdded(newNode.id)
      return
    }

    const id = `${entry.nodeType}-${Date.now()}`
    const newNode = buildGeneralNode(id, entry, position)
    if (!newNode) return
    onNodesChange([{ type: 'add', item: newNode }])
    onGeneralNodeAdded(id, entry.nodeType, entry.label)
  }, [hasTrigger, screenToFlowPosition, onNodesChange, onTriggerAdded, onGeneralNodeAdded])

  useEffect(() => {
    dropHandlerRef.current = (event: React.DragEvent<HTMLDivElement>) => {
      const raw = event.dataTransfer.getData(NODE_DRAG_TYPE)
      if (!raw) return
      const entry = decodeDragPayload(raw)
      if (!entry) return
      addNode(entry, { x: event.clientX, y: event.clientY })
    }
  }, [addNode, dropHandlerRef])

  const addManualTrigger = () => {
    addNode({ kind: 'trigger', nodeType: 'trigger', triggerId: 'manual', label: 'Manual Trigger' })
  }

  return (
    <>
      <NodesSidebar
        onAddNode={(entry) => addNode(entry)}
        triggerDisabled={hasTrigger}
      />
      {!hasTrigger && <AddTriggerButton onClick={addManualTrigger} />}
    </>
  )
}
