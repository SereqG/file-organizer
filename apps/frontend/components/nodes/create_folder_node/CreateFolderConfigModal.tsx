'use client'

import type { CreateFolderNode } from '@/lib/types/workflow'
import type { FileTreeNode } from '@/lib/types/explore'
import { useCreateFolderConfig } from '@/hooks/useCreateFolderConfig'
import { FolderNameField } from './FolderNameField'
import { ParentFolderField } from './ParentFolderField'
import { IfExistsField } from './IfExistsField'
import { ValidationMessages } from './ValidationMessages'
import { ActionButtons } from './ActionButtons'

interface CreateFolderConfigModalProps {
  nodeId: string
  workspaceTree: FileTreeNode
  onClose: () => void
  onSave: (config: CreateFolderNode['config']) => void
}

export function CreateFolderConfigModal({ nodeId, workspaceTree, onClose, onSave }: CreateFolderConfigModalProps) {
  const {
    folderName, setFolderName,
    parentFolderId, setParentFolderId,
    ifExists, setIfExists,
    selectedParentNode,
    validation,
    handleSave,
  } = useCreateFolderConfig({ nodeId, workspaceTree, onSave, onClose })

  const errorCount = Object.keys(validation.errors).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-[480px] flex flex-col rounded-xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-medium text-white/80">Configure Create Folder</span>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <FolderNameField
            value={folderName}
            onChange={setFolderName}
            error={validation.errors.folderName}
          />
          <ParentFolderField
            workspaceTree={workspaceTree}
            selectedId={parentFolderId}
            selectedNode={selectedParentNode}
            onSelect={(node) => setParentFolderId(node.id)}
            error={validation.errors.parentFolderId}
          />
          <IfExistsField
            value={ifExists}
            onChange={setIfExists}
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
          <ValidationMessages errorCount={errorCount} />
          <ActionButtons
            onCancel={onClose}
            onSave={handleSave}
            saveDisabled={!validation.valid}
          />
        </div>
      </div>
    </div>
  )
}
