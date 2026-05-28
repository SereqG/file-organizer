'use client'

import { useCallback } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import { TrashIcon } from '../shared/TrashIcon'
import { ManualTriggerIcon } from './ManualTriggerIcon'
import { ScheduleTriggerIcon } from './ScheduleTriggerIcon'

export interface TriggerNodeData extends Record<string, unknown> {
  label: string
  triggerId: string
}

export type TriggerRFNode = Node<TriggerNodeData, 'trigger'>

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  manual: <ManualTriggerIcon />,
  schedule: <ScheduleTriggerIcon />,
}

export function TriggerNode({ id, data }: NodeProps<TriggerRFNode>) {
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
        {TRIGGER_ICONS[data.triggerId]}
      </span>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-orange-500/70 font-medium">Trigger</div>
        <div className="text-xs text-white/80">{data.label}</div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!border-orange-500/40 !bg-[#111]"
      />
    </div>
  )
}
