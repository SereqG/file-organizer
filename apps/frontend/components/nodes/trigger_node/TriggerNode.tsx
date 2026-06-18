'use client'

import { useCallback } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import { LuMousePointer2 } from 'react-icons/lu'
import { NodeDeleteButton } from '@/components/nodes/shared/NodeDeleteButton'

export interface TriggerNodeData extends Record<string, unknown> {
  label: string
  triggerId: string
}

export type TriggerRFNode = Node<TriggerNodeData, 'trigger'>

export function TriggerNode({ id, data }: NodeProps<TriggerRFNode>) {
  const { deleteElements } = useReactFlow()

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  return (
    <div className="relative flex items-center gap-2.5 rounded-lg border border-orange-500/40 bg-[#111] px-3 py-2.5 shadow-lg min-w-36">
      <NodeDeleteButton onClick={handleDelete} />

      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-orange-500/30 bg-orange-500/10 text-orange-400">
        <LuMousePointer2 size={16} />
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
