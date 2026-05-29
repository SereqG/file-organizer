'use client'

import { useCallback } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { ConditionGroup, IfNode as IfNodeType } from '@/lib/types/workflow'
import { useNodeConfig } from '@/lib/contexts/NodeConfigContext'
import { LuTrash2, LuGitBranch } from 'react-icons/lu'

export interface IfNodeData extends Record<string, unknown> {
  label: string
  config?: IfNodeType['config']
}

export type IfRFNode = Node<IfNodeData, 'if'>

function countConditions(group: ConditionGroup): number {
  let count = 0
  for (const child of group.children) {
    if ('children' in child) count += countConditions(child)
    else count += 1
  }
  return count
}

export function IfNode({ id, data }: NodeProps<IfRFNode>) {
  const { deleteElements } = useReactFlow()
  const { openIfNodeConfig } = useNodeConfig()

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  const handleOpen = useCallback(() => {
    openIfNodeConfig(id)
  }, [id, openIfNodeConfig])

  const conditionCount = data.config ? countConditions(data.config.conditions) : 0
  const configured = conditionCount > 0

  return (
    <div
      onClick={handleOpen}
      className="relative flex items-center gap-2.5 rounded-lg border border-orange-500/40 bg-[#111] px-3 py-2.5 pr-8 shadow-lg min-w-40 cursor-pointer transition-colors hover:border-orange-500/70"
    >
      <button
        onClick={handleDelete}
        className="absolute -top-2.5 -right-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-red-500/60 bg-[#111] text-red-500/80 transition-colors hover:border-red-500 hover:bg-red-500/10 hover:text-red-400"
        aria-label="Delete node"
      >
        <LuTrash2 size={10} />
      </button>

      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-orange-500/30 bg-orange-500/10 text-orange-400">
        <LuGitBranch size={16} />
      </span>
      <div className="flex flex-col gap-0.5">
        <div className="text-[10px] uppercase tracking-wider text-orange-500/70 font-medium">If</div>
        <div className="text-xs text-white/80">{data.label}</div>
        <div className={`text-[9px] uppercase tracking-wider ${configured ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
          {configured ? `${conditionCount} ${conditionCount === 1 ? 'condition' : 'conditions'}` : 'Not configured'}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!border-orange-500/40 !bg-[#111]"
      />

      <Handle
        type="source"
        id="true"
        position={Position.Right}
        style={{ top: '30%' }}
        className="!border-emerald-400/60 !bg-[#111]"
      />
      <span className="pointer-events-none absolute right-2 top-[calc(30%-7px)] text-[9px] font-medium uppercase tracking-wider text-emerald-400/70">
        T
      </span>

      <Handle
        type="source"
        id="false"
        position={Position.Right}
        style={{ top: '70%' }}
        className="!border-rose-400/60 !bg-[#111]"
      />
      <span className="pointer-events-none absolute right-2 top-[calc(70%-7px)] text-[9px] font-medium uppercase tracking-wider text-rose-400/70">
        F
      </span>
    </div>
  )
}
