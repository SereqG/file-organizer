'use client'

import { useCallback } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { CreateFolderNode as CreateFolderNodeType } from '@/lib/types/workflow'
import { useNodeConfig } from '@/lib/contexts/NodeConfigContext'
import { TrashIcon } from '../shared/TrashIcon'
import { FolderPlusIcon } from './FolderPlusIcon'

export interface CreateFolderNodeData extends Record<string, unknown> {
  label: string
  config?: CreateFolderNodeType['config']
}

export type CreateFolderRFNode = Node<CreateFolderNodeData, 'createFolder'>

export function CreateFolderNode({ id, data }: NodeProps<CreateFolderRFNode>) {
  const { deleteElements } = useReactFlow()
  const { openCreateFolderNodeConfig } = useNodeConfig()

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  const handleOpen = useCallback(() => {
    openCreateFolderNodeConfig(id)
  }, [id, openCreateFolderNodeConfig])

  const folderName = data.config?.folderName
  const configured = !!(folderName && data.config?.parentFolderId)

  return (
    <div
      onClick={handleOpen}
      className="relative flex items-center gap-2.5 rounded-lg border border-sky-500/40 bg-[#111] px-3 py-2.5 shadow-lg min-w-40 cursor-pointer transition-colors hover:border-sky-500/70"
    >
      <button
        onClick={handleDelete}
        className="absolute -top-2.5 -right-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-red-500/60 bg-[#111] text-red-500/80 transition-colors hover:border-red-500 hover:bg-red-500/10 hover:text-red-400"
        aria-label="Delete node"
      >
        <TrashIcon />
      </button>

      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-sky-500/30 bg-sky-500/10 text-sky-400">
        <FolderPlusIcon />
      </span>
      <div className="flex flex-col gap-0.5">
        <div className="text-[10px] uppercase tracking-wider text-sky-500/70 font-medium">Create</div>
        <div className="text-xs text-white/80">{data.label}</div>
        <div className={`text-[9px] uppercase tracking-wider ${configured ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
          {configured ? folderName : 'Not configured'}
        </div>
      </div>

      <Handle type="target" position={Position.Left} className="!border-sky-500/40 !bg-[#111]" />
      <Handle type="source" position={Position.Right} className="!border-sky-500/40 !bg-[#111]" />
    </div>
  )
}
