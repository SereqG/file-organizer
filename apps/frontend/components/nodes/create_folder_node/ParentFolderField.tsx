'use client'

import type { FileTreeNode } from '@/lib/types/explore'
import { FolderPicker } from './FolderPicker'

interface ParentFolderFieldProps {
  workspaceTree: FileTreeNode
  selectedPath: string
  selectedNode: FileTreeNode | null
  onSelect: (node: FileTreeNode) => void
  error?: string
}

export function ParentFolderField({ workspaceTree, selectedPath, selectedNode, onSelect, error }: ParentFolderFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-white/60">
        Parent folder
      </label>
      <FolderPicker
        root={workspaceTree}
        selectedPath={selectedPath || null}
        onSelect={onSelect}
      />
      {selectedNode ? (
        <span
          title={selectedNode.path}
          className="text-[11px] text-sky-400/70 font-mono truncate hover:overflow-visible hover:whitespace-normal hover:break-all"
        >
          {selectedNode.path}
        </span>
      ) : (
        <span className="text-[11px] text-white/25">Select a folder from the tree above</span>
      )}
      {error && <span className="text-[11px] text-rose-400/80">{error}</span>}
    </div>
  )
}
