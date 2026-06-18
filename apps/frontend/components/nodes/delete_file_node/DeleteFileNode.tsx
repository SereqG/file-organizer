'use client'

import { useCallback } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { DeleteFileNode as DeleteFileNodeType } from '@/lib/types/workflow'
import { useNodeConfig } from '@/lib/contexts/NodeConfigContext'
import { useWorkflowRun } from '@/lib/contexts/WorkflowRunContext'
import { LuFileX, LuLoaderCircle } from 'react-icons/lu'
import { NodeDeleteButton } from '@/components/nodes/shared/NodeDeleteButton'

export interface DeleteFileNodeData extends Record<string, unknown> {
  label: string
  config?: DeleteFileNodeType['config']
  executionError?: string
}

export type DeleteFileRFNode = Node<DeleteFileNodeData, 'deleteFile'>

export function DeleteFileNode({ id, data }: NodeProps<DeleteFileRFNode>) {
  const { deleteElements } = useReactFlow()
  const { openDeleteFileNodeConfig } = useNodeConfig()
  const { currentNodeId } = useWorkflowRun()

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  const handleOpen = useCallback(() => {
    openDeleteFileNodeConfig(id)
  }, [id, openDeleteFileNodeConfig])

  const deleteAllEncountered = data.config?.deleteAllEncountered ?? false
  const fileCount = data.config?.filePaths?.length ?? 0
  const configured = deleteAllEncountered || fileCount > 0
  const hasError = !!data.executionError
  const isActive = currentNodeId === id

  const summary = deleteAllEncountered
    ? 'All encountered files'
    : configured
      ? `${fileCount} file${fileCount === 1 ? '' : 's'}`
      : 'Not configured'

  return (
    <div
      onClick={handleOpen}
      className={`relative flex items-center gap-2.5 rounded-lg border bg-[#111] px-3 py-2.5 shadow-lg min-w-40 cursor-pointer transition-colors ${hasError ? 'border-red-500/70 hover:border-red-500' : 'border-rose-500/40 hover:border-rose-500/70'}`}
    >
      <NodeDeleteButton onClick={handleDelete} />
      {isActive && (
        <div className="absolute top-1.5 right-1.5">
          <LuLoaderCircle size={12} className="animate-spin text-white/60" />
        </div>
      )}

      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-400">
        <LuFileX size={16} />
      </span>
      <div className="flex flex-col gap-0.5">
        <div className="text-[10px] uppercase tracking-wider text-rose-500/70 font-medium">Delete</div>
        <div className="text-xs text-white/80">{data.label}</div>
        <div className={`text-[9px] uppercase tracking-wider ${configured ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
          {summary}
        </div>
        {hasError && (
          <div className="text-[9px] text-red-400/80 max-w-[140px] truncate" title={data.executionError}>
            {data.executionError}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} className="!border-rose-500/40 !bg-[#111]" />
      <Handle type="source" position={Position.Right} className="!border-rose-500/40 !bg-[#111]" />
    </div>
  )
}
