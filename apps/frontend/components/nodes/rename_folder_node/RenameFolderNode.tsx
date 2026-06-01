'use client'

import { useCallback } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { RenameFolderNode as RenameFolderNodeType } from '@/lib/types/workflow'
import { useNodeConfig } from '@/lib/contexts/NodeConfigContext'
import { LuTrash2, LuFolderPen } from 'react-icons/lu'

export interface RenameFolderNodeData extends Record<string, unknown> {
  label: string
  config?: RenameFolderNodeType['config']
  executionError?: string
}

export type RenameFolderRFNode = Node<RenameFolderNodeData, 'renameFolder'>

export function RenameFolderNode({ id, data }: NodeProps<RenameFolderRFNode>) {
  const { deleteElements } = useReactFlow()
  const { openRenameFolderNodeConfig } = useNodeConfig()

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  const handleOpen = useCallback(() => {
    openRenameFolderNodeConfig(id)
  }, [id, openRenameFolderNodeConfig])

  const newName = data.config?.newName
  const configured = !!(data.config?.folderPath && newName)
  const hasError = !!data.executionError

  return (
    <div
      onClick={handleOpen}
      className={`relative flex items-center gap-2.5 rounded-lg border bg-[#111] px-3 py-2.5 shadow-lg min-w-40 cursor-pointer transition-colors ${hasError ? 'border-red-500/70 hover:border-red-500' : 'border-amber-500/40 hover:border-amber-500/70'}`}
    >
      <button
        onClick={handleDelete}
        className="absolute -top-2.5 -right-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-red-500/60 bg-[#111] text-red-500/80 transition-colors hover:border-red-500 hover:bg-red-500/10 hover:text-red-400"
        aria-label="Delete node"
      >
        <LuTrash2 size={10} />
      </button>

      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400">
        <LuFolderPen size={16} />
      </span>
      <div className="flex flex-col gap-0.5">
        <div className="text-[10px] uppercase tracking-wider text-amber-500/70 font-medium">Rename</div>
        <div className="text-xs text-white/80">{data.label}</div>
        <div className={`text-[9px] uppercase tracking-wider ${configured ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
          {configured ? newName : 'Not configured'}
        </div>
        {hasError && (
          <div className="text-[9px] text-red-400/80 max-w-[140px] truncate" title={data.executionError}>
            {data.executionError}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} className="!border-amber-500/40 !bg-[#111]" />
      <Handle type="source" position={Position.Right} className="!border-amber-500/40 !bg-[#111]" />
    </div>
  )
}
