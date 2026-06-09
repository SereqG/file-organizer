'use client'

import { useCallback } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { MoveFileNode as MoveFileNodeType } from '@/lib/types/workflow'
import { useNodeConfig } from '@/lib/contexts/NodeConfigContext'
import { useWorkflowRun } from '@/lib/contexts/WorkflowRunContext'
import { LuTrash2, LuFolderInput, LuFileInput, LuLoaderCircle } from 'react-icons/lu'

export interface MoveNodeData extends Record<string, unknown> {
  label: string
  config?: MoveFileNodeType['config']
  executionError?: string
}

// One component serves both move types; the React Flow node type distinguishes file vs folder.
export type MoveRFNode = Node<MoveNodeData, 'moveFile' | 'moveFolder'>

export function MoveNode({ id, type, data }: NodeProps<MoveRFNode>) {
  const { deleteElements } = useReactFlow()
  const { openMoveNodeConfig } = useNodeConfig()
  const { currentNodeId } = useWorkflowRun()

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  const handleOpen = useCallback(() => openMoveNodeConfig(id), [id, openMoveNodeConfig])

  const isFolder = type === 'moveFolder'
  const configured = !!data.config?.targetPath
  const hasError = !!data.executionError
  const isActive = currentNodeId === id

  return (
    <div
      onClick={handleOpen}
      className={`relative flex items-center gap-2.5 rounded-lg border bg-[#111] px-3 py-2.5 shadow-lg min-w-40 cursor-pointer transition-colors ${hasError ? 'border-red-500/70 hover:border-red-500' : 'border-violet-500/40 hover:border-violet-500/70'}`}
    >
      <button
        onClick={handleDelete}
        className="absolute -top-2.5 -right-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-red-500/60 bg-[#111] text-red-500/80 transition-colors hover:border-red-500 hover:bg-red-500/10 hover:text-red-400"
        aria-label="Delete node"
      >
        <LuTrash2 size={10} />
      </button>
      {isActive && (
        <div className="absolute top-1.5 right-1.5">
          <LuLoaderCircle size={12} className="animate-spin text-white/60" />
        </div>
      )}

      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-violet-500/30 bg-violet-500/10 text-violet-400">
        {isFolder ? <LuFolderInput size={16} /> : <LuFileInput size={16} />}
      </span>
      <div className="flex flex-col gap-0.5">
        <div className="text-[10px] uppercase tracking-wider text-violet-500/70 font-medium">
          {isFolder ? 'Move folder' : 'Move file'}
        </div>
        <div className="text-xs text-white/80">{data.label}</div>
        <div className={`text-[9px] uppercase tracking-wider ${configured ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
          {configured ? 'Configured' : 'Not configured'}
        </div>
        {hasError && (
          <div className="text-[9px] text-red-400/80 max-w-[140px] truncate" title={data.executionError}>
            {data.executionError}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} className="!border-violet-500/40 !bg-[#111]" />
      <Handle type="source" position={Position.Right} className="!border-violet-500/40 !bg-[#111]" />
    </div>
  )
}
