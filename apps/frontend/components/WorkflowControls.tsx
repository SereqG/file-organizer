'use client'

import { useCallback, useEffect, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { Node, OnNodesChange } from '@xyflow/react'
import { NodesSidebar } from './NodesSidebar'
import { AddTriggerButton } from './AddTriggerButton'
import { TriggerSelectModal } from './TriggerSelectModal'
import type { TriggerId } from './TriggerSelectModal'

const TRIGGER_LABELS: Record<TriggerId, string> = {
  manual: 'Manual Trigger',
  schedule: 'Schedule',
}

interface WorkflowControlsProps {
  hasTrigger: boolean
  onNodesChange: OnNodesChange<Node>
  onTriggerAdded: (triggerId: TriggerId) => void
  dropHandlerRef: React.MutableRefObject<((e: React.DragEvent<HTMLDivElement>) => void) | null>
}

export function WorkflowControls({ hasTrigger, onNodesChange, onTriggerAdded, dropHandlerRef }: WorkflowControlsProps) {
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
    onTriggerAdded(triggerId)
  }, [hasTrigger, screenToFlowPosition, onNodesChange, onTriggerAdded])

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
