'use client'

import type { NodeDescriptor } from '@/lib/types/workflowNodeDescriptor'
import type { NodeEntry } from '@/lib/workflow/registry/nodeCatalog'
import { encodeDragPayload, NODE_DRAG_TYPE } from './dragPayload'

interface NodeItemProps extends NodeEntry {
  disabled?: boolean
  onAddNode: (entry: NodeDescriptor) => void
}

export function NodeItem({ kind, nodeType, triggerId, label, icon, disabled, onAddNode }: NodeItemProps) {
  const descriptor: NodeDescriptor = { kind, nodeType, triggerId, label }

  const handleDragStart = (event: React.DragEvent) => {
    if (disabled) { event.preventDefault(); return }
    event.dataTransfer.setData(NODE_DRAG_TYPE, encodeDragPayload(descriptor))
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-35'
          : 'cursor-grab text-white/60 hover:bg-white/5 hover:text-white/90 active:cursor-grabbing'
      }`}
      draggable={!disabled}
      onClick={() => { if (!disabled) onAddNode(descriptor) }}
      onDragStart={handleDragStart}
    >
      <span className="flex-shrink-0 text-white/40">{icon}</span>
      <span className="text-xs">{label}</span>
    </div>
  )
}
