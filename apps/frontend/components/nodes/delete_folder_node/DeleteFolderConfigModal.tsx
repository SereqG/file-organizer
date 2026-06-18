'use client'

import type { DeleteFolderNode } from '@/lib/types/workflow'
import type { FileTreeNode } from '@/lib/types/explore'
import { useDeleteFolderConfig } from '@/hooks/useDeleteFolderConfig'
import { DeleteModeField } from './DeleteModeField'
import { DeleteTargetField } from './DeleteTargetField'
import { ValidationMessages } from '@/components/nodes/create_folder_node/ValidationMessages'
import { ActionButtons } from '@/components/nodes/create_folder_node/ActionButtons'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { ConfigErrorPanel } from '@/components/shared/ConfigErrorPanel'
import { Modal } from '@/components/shared/Modal'
import { NodeSimulationBar } from '@/components/nodes/shared/NodeSimulationBar'


interface DeleteFolderConfigModalProps {
  nodeId: string
  workspaceTree: FileTreeNode
  onClose: () => void
  onSave: (config: DeleteFolderNode['config']) => void
}

export function DeleteFolderConfigModal({ nodeId, workspaceTree, onClose, onSave }: DeleteFolderConfigModalProps) {
  const {
    deleteAllEncountered, setDeleteAllEncountered,
    folderPaths, toggleFolder,
    validation,
    handleSave,
  } = useDeleteFolderConfig({ nodeId, onSave, onClose })

  const errorCount = Object.keys(validation.fieldErrors).length + validation.formErrors.length

  return (
    <Modal onClose={onClose} ariaLabel="Configure Delete Folder">
      <div className="w-[480px] flex flex-col rounded-xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-medium text-white/80">Configure Delete Folder</span>
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

        <ErrorBoundary fallback={(error) => <ConfigErrorPanel error={error} onClose={onClose} />}>
          <div className="flex flex-col gap-4 p-4">
            <DeleteModeField
              value={deleteAllEncountered}
              onChange={setDeleteAllEncountered}
            />
            <DeleteTargetField
              workspaceTree={workspaceTree}
              selectedPaths={folderPaths}
              onToggle={toggleFolder}
              disabled={deleteAllEncountered}
              error={validation.fieldErrors.folderPaths}
            />
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
            <NodeSimulationBar />
            <div className="flex items-center gap-2">
              <ValidationMessages errorCount={errorCount} />
              <ActionButtons
                onCancel={onClose}
                onSave={handleSave}
                saveDisabled={!validation.valid}
              />
            </div>
          </div>
        </ErrorBoundary>
      </div>
    </Modal>
  )
}
