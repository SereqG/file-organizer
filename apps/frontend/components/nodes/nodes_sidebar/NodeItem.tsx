'use client'

import type { NodeDescriptor } from '@/lib/types/workflowNodeDescriptor'
import type { NodeEntry } from '@/lib/workflow/registry/nodeCatalog'
import { encodeDragPayload, NODE_DRAG_TYPE } from './dragPayload'

interface NodeItemProps extends NodeEntry {
  disabled?: boolean
  isAiAvailable?: boolean
  onAddNode: (entry: NodeDescriptor) => void
}

export function NodeItem({ kind, nodeType, triggerId, label, icon, requiresApiKey, badge, disabled, isAiAvailable, onAddNode }: NodeItemProps) {
  const descriptor: NodeDescriptor = { kind, nodeType, triggerId, label }

  const lockedForAi = !!requiresApiKey && !isAiAvailable
  const isDisabled = !!disabled || lockedForAi

  const handleDragStart = (event: React.DragEvent) => {
    if (isDisabled) { event.preventDefault(); return }
    event.dataTransfer.setData(NODE_DRAG_TYPE, encodeDragPayload(descriptor))
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="group relative">
      <div
        className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors ${
          isDisabled
            ? 'cursor-not-allowed opacity-35'
            : 'cursor-grab text-white/60 hover:bg-white/5 hover:text-white/90 active:cursor-grabbing'
        }`}
        draggable={!isDisabled}
        onClick={() => { if (!isDisabled) onAddNode(descriptor) }}
        onDragStart={handleDragStart}
      >
        <span className="flex-shrink-0 text-white/40">{icon}</span>
        <span className="text-xs">{label}</span>
        {badge === 'ai' && (
          <span className="ml-auto rounded-full bg-gradient-to-r from-blue-500 to-violet-600 px-1.5 text-[9px] font-bold leading-[1.4] tracking-wide text-white">
            AI
          </span>
        )}
      </div>

      {lockedForAi && (
        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 w-44 -translate-x-1/2 rounded-md border border-white/10 bg-[#1a1a1a] px-2 py-1.5 text-[11px] leading-snug text-white/80 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          Add an OpenRouter API key in Run Settings to use AI nodes.
        </span>
      )}
    </div>
  )
}
