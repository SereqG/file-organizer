'use client'

import { Fragment, useCallback } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import { SWITCH_DEFAULT_HANDLE, type SwitchNode as SwitchNodeType } from '@/lib/types/workflow'
import { SWITCH_DEFAULT_COLOR, switchOutputColor } from '@/lib/workflow/utils/switchColors'
import { useNodeConfig } from '@/lib/contexts/NodeConfigContext'
import { useWorkflowRun } from '@/lib/contexts/WorkflowRunContext'
import { LuTrash2, LuSplit, LuLoaderCircle } from 'react-icons/lu'

export interface SwitchNodeData extends Record<string, unknown> {
  label: string
  config?: SwitchNodeType['config']
  executionError?: string
}

export type SwitchRFNode = Node<SwitchNodeData, 'switch'>

// The node grows with its output count: each output gets a vertical slot, evenly distributed.
const HEADER_HEIGHT = 56
const OUTPUT_SLOT = 22

interface OutputHandle {
  id: string
  label: string
  color: string
}

function buildOutputs(config?: SwitchNodeType['config']): OutputHandle[] {
  const cases = config?.cases ?? []
  const outputs: OutputHandle[] = cases.map((switchCase, index) => ({
    id: switchCase.id,
    label: String(index + 1),
    color: switchOutputColor(index),
  }))
  outputs.push({ id: SWITCH_DEFAULT_HANDLE, label: 'else', color: SWITCH_DEFAULT_COLOR })
  return outputs
}

export function SwitchNode({ id, data }: NodeProps<SwitchRFNode>) {
  const { deleteElements } = useReactFlow()
  const { openSwitchNodeConfig } = useNodeConfig()
  const { currentNodeId } = useWorkflowRun()

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  const handleOpen = useCallback(() => {
    openSwitchNodeConfig(id)
  }, [id, openSwitchNodeConfig])

  const cases = data.config?.cases ?? []
  const outputs = buildOutputs(data.config)
  const configured = cases.length > 0 && cases.every((c) => c.conditions.children.length > 0)
  const hasError = !!data.executionError
  const isActive = currentNodeId === id

  return (
    <div
      onClick={handleOpen}
      style={{ minHeight: HEADER_HEIGHT + outputs.length * OUTPUT_SLOT }}
      className={`relative flex items-center gap-2.5 rounded-lg border bg-[#111] px-3 py-2.5 pr-8 shadow-lg min-w-44 cursor-pointer transition-colors ${hasError ? 'border-red-500/70 hover:border-red-500' : 'border-orange-500/40 hover:border-orange-500/70'}`}
    >
      <button
        onClick={handleDelete}
        className="absolute -top-2.5 -right-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-red-500/60 bg-[#111] text-red-500/80 transition-colors hover:border-red-500 hover:bg-red-500/10 hover:text-red-400"
        aria-label="Delete node"
      >
        <LuTrash2 size={10} />
      </button>
      {isActive && (
        <div className="absolute top-1.5 left-1.5">
          <LuLoaderCircle size={12} className="animate-spin text-white/60" />
        </div>
      )}

      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-orange-500/30 bg-orange-500/10 text-orange-400">
        <LuSplit size={16} />
      </span>
      <div className="flex flex-col gap-0.5">
        <div className="text-[10px] uppercase tracking-wider text-orange-500/70 font-medium">Switch</div>
        <div className="text-xs text-white/80">{data.label}</div>
        <div className={`text-[9px] uppercase tracking-wider ${configured ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
          {configured ? `${cases.length} ${cases.length === 1 ? 'output' : 'outputs'}` : 'Not configured'}
        </div>
        {hasError && (
          <div className="text-[9px] text-red-400/80 max-w-[140px] truncate" title={data.executionError}>
            {data.executionError}
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!border-orange-500/40 !bg-[#111]"
      />

      {outputs.map((output, index) => {
        const top = `${((index + 1) / (outputs.length + 1)) * 100}%`
        return (
          <Fragment key={output.id}>
            <Handle
              type="source"
              id={output.id}
              position={Position.Right}
              style={{ top, borderColor: output.color }}
              className="!bg-[#111]"
            />
            <span
              className="pointer-events-none absolute right-2 text-[9px] font-medium uppercase tracking-wider"
              style={{ top: `calc(${top} - 7px)`, color: output.color }}
            >
              {output.label}
            </span>
          </Fragment>
        )
      })}
    </div>
  )
}
