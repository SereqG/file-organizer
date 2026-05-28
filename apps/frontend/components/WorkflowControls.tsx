'use client'

import { useCallback, useEffect, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { OnNodesChange } from '@xyflow/react'
import type { AppNode } from '@/hooks/useWorkflowEditor'
import { NodesSidebar } from './nodes/nodes_sidebar/NodesSidebar'
import { AddTriggerButton } from './AddTriggerButton'
import { TriggerSelectModal } from './TriggerSelectModal'
import type { TriggerId } from './TriggerSelectModal'
import type { NodeDescriptor } from '@/lib/types/workflowNodeDescriptor'
import { decodeDragPayload, NODE_DRAG_TYPE } from './nodes/nodes_sidebar/dragPayload'

const TRIGGER_LABELS: Record<TriggerId, string> = {
  manual: 'Manual Trigger',
  schedule: 'Schedule',
}

interface WorkflowControlsProps {
  hasTrigger: boolean
  onNodesChange: OnNodesChange<AppNode>
  onTriggerAdded: (triggerId: TriggerId) => void
  onGeneralNodeAdded: (id: string, nodeType: string, label: string) => void
  dropHandlerRef: React.MutableRefObject<((e: React.DragEvent<HTMLDivElement>) => void) | null>
}

export function WorkflowControls({ hasTrigger, onNodesChange, onTriggerAdded, onGeneralNodeAdded, dropHandlerRef }: WorkflowControlsProps) {
  const { screenToFlowPosition } = useReactFlow()
  const [modalOpen, setModalOpen] = useState(false)

  const addNode = useCallback((entry: NodeDescriptor, clientPos?: { x: number; y: number }) => {
    const screenPos = clientPos ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const position = screenToFlowPosition(screenPos)

    if (entry.kind === 'trigger') {
      if (hasTrigger) return
      const triggerId = entry.triggerId as TriggerId
      const newNode: AppNode = {
        id: `trigger-${Date.now()}`,
        type: 'trigger',
        position,
        data: { label: entry.label, triggerId },
      }
      onNodesChange([{ type: 'add', item: newNode }])
      onTriggerAdded(triggerId)
      return
    }

    const id = `${entry.nodeType}-${Date.now()}`
    const newNode: AppNode = entry.nodeType === 'if'
      ? { id, type: 'if', position, data: { label: entry.label, config: { conditions: { id: `group-${Date.now()}`, operator: 'AND' as const, children: [] } } } }
      : { id, type: 'createFolder', position, data: { label: entry.label } }
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

  const addTriggerFromModal = (id: TriggerId) => {
    addNode({ kind: 'trigger', nodeType: 'trigger', triggerId: id, label: TRIGGER_LABELS[id] })
    setModalOpen(false)
  }

  return (
    <>
      <NodesSidebar
        onAddNode={(entry) => addNode(entry)}
        triggerDisabled={hasTrigger}
      />
      {!hasTrigger && <AddTriggerButton onClick={() => setModalOpen(true)} />}
      {modalOpen && (
        <TriggerSelectModal
          onSelect={addTriggerFromModal}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
