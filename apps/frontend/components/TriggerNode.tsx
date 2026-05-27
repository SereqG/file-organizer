'use client'

import { useCallback } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

export interface TriggerNodeData {
  label: string
  triggerId: string
}

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  manual: (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3.5V10L8 8H13L6 3.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 8L10.5 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  schedule: (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 5.5V9L11 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

function TrashIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 3h9M4.5 3V2h3v1M5 5.5v3M7 5.5v3M2.5 3l.5 7h6l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function TriggerNode({ id, data }: NodeProps) {
  const nodeData = data as unknown as TriggerNodeData
  const { deleteElements } = useReactFlow()

  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  return (
    <div className="relative flex items-center gap-2.5 rounded-lg border border-orange-500/40 bg-[#111] px-3 py-2.5 shadow-lg min-w-36">
      <button
        onClick={handleDelete}
        className="absolute -top-2.5 -right-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-red-500/60 bg-[#111] text-red-500/80 transition-colors hover:border-red-500 hover:bg-red-500/10 hover:text-red-400"
        aria-label="Delete node"
      >
        <TrashIcon />
      </button>

      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-orange-500/30 bg-orange-500/10 text-orange-400">
        {TRIGGER_ICONS[nodeData.triggerId]}
      </span>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-orange-500/70 font-medium">Trigger</div>
        <div className="text-xs text-white/80">{nodeData.label}</div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!border-orange-500/40 !bg-[#111]"
      />
    </div>
  )
}
