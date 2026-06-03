'use client'

import type { FileTreeNode } from '@/lib/types/explore'
import { MultiFolderPicker } from './MultiFolderPicker'

interface DeleteTargetFieldProps {
  workspaceTree: FileTreeNode
  selectedPaths: string[]
  onToggle: (path: string) => void
  disabled?: boolean
  error?: string
}

export function DeleteTargetField({ workspaceTree, selectedPaths, onToggle, disabled, error }: DeleteTargetFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-white/60">
        Folders to delete
      </label>
      <MultiFolderPicker
        root={workspaceTree}
        selectedPaths={selectedPaths}
        onToggle={onToggle}
        disabled={disabled}
      />
      {!disabled && selectedPaths.length > 0 && (
        <span className="text-[11px] text-rose-400/70">{selectedPaths.length} selected</span>
      )}
      {error && <span className="text-[11px] text-rose-400/80">{error}</span>}
    </div>
  )
}
