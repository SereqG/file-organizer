'use client'

import { useCallback } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { DeleteFolderNode as DeleteFolderNodeType } from '@/lib/types/workflow'
import { useNodeConfig } from '@/lib/contexts/NodeConfigContext'
import { LuTrash2, LuFolderX } from 'react-icons/lu'

export interface DeleteFolderNodeData extends Record<string, unknown> {
  label: string
  config?: DeleteFolderNodeType['config']
  executionError?: string
}

export type DeleteFolderRFNode = Node<DeleteFolderNodeData, 'deleteFolder'>

export function DeleteFolderNode({ id, data }: NodeProps<DeleteFolderRFNode>) {
  const { deleteElements } = useReactFlow()
  const { openDeleteFolderNodeConfig } = useNodeConfig()

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  const handleOpen = useCallback(() => {
    openDeleteFolderNodeConfig(id)
  }, [id, openDeleteFolderNodeConfig])

  const deleteAllEncountered = data.config?.deleteAllEncountered ?? false
  const folderCount = data.config?.folderPaths?.length ?? 0
  const configured = deleteAllEncountered || folderCount > 0
  const hasError = !!data.executionError

  const summary = deleteAllEncountered
    ? 'All encountered dirs'
    : configured
      ? `${folderCount} folder${folderCount === 1 ? '' : 's'}`
      : 'Not configured'

  return (
    <div
      onClick={handleOpen}
      className={`relative flex items-center gap-2.5 rounded-lg border bg-[#111] px-3 py-2.5 shadow-lg min-w-40 cursor-pointer transition-colors ${hasError ? 'border-red-500/70 hover:border-red-500' : 'border-rose-500/40 hover:border-rose-500/70'}`}
    >
      <button
        onClick={handleDelete}
        className="absolute -top-2.5 -right-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-red-500/60 bg-[#111] text-red-500/80 transition-colors hover:border-red-500 hover:bg-red-500/10 hover:text-red-400"
        aria-label="Delete node"
      >
        <LuTrash2 size={10} />
      </button>

      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-rose-500/30 bg-rose-500/10 text-rose-400">
        <LuFolderX size={16} />
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
