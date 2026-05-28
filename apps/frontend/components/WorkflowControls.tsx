'use client'

import { useCallback, useEffect, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { Node, OnNodesChange } from '@xyflow/react'
import { NodesSidebar } from './nodes/nodes_sidebar/NodesSidebar'
import { AddTriggerButton } from './AddTriggerButton'
import { TriggerSelectModal } from './TriggerSelectModal'
import type { TriggerId } from './TriggerSelectModal'
import type { NodeDescriptor } from '@/lib/types/workflowNodeDescriptor'

const TRIGGER_LABELS: Record<TriggerId, string> = {
  manual: 'Manual Trigger',
  schedule: 'Schedule',
}

interface WorkflowControlsProps {
  hasTrigger: boolean
  onNodesChange: OnNodesChange<Node>
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
      const newNode: Node = {
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
    const data = entry.nodeType === 'if'
      ? { label: entry.label, config: { conditions: { id: `group-${Date.now()}`, operator: 'AND', children: [] } } }
      : { label: entry.label }
    const newNode: Node = { id, type: entry.nodeType, position, data }
    onNodesChange([{ type: 'add', item: newNode }])
    onGeneralNodeAdded(id, entry.nodeType, entry.label)
  }, [hasTrigger, screenToFlowPosition, onNodesChange, onTriggerAdded, onGeneralNodeAdded])

  useEffect(() => {
    dropHandlerRef.current = (event: React.DragEvent<HTMLDivElement>) => {
      const raw = event.dataTransfer.getData('application/node')
      if (!raw) return
      const entry = JSON.parse(raw) as NodeDescriptor
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
