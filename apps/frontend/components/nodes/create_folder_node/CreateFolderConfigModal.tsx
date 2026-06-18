'use client'

import type { CreateFolderNode } from '@/lib/types/workflow'
import type { FileTreeNode } from '@/lib/types/explore'
import { useCreateFolderConfig } from '@/hooks/useCreateFolderConfig'
import { FolderNameField } from './FolderNameField'
import { ParentFolderField } from './ParentFolderField'
import { IfExistsField } from './IfExistsField'
import { ValidationMessages } from './ValidationMessages'
import { ActionButtons } from './ActionButtons'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { ConfigErrorPanel } from '@/components/shared/ConfigErrorPanel'
import { Modal } from '@/components/shared/Modal'
import { NodeSimulationBar } from '@/components/nodes/shared/NodeSimulationBar'


interface CreateFolderConfigModalProps {
  nodeId: string
  workspaceTree: FileTreeNode
  onClose: () => void
  onSave: (config: CreateFolderNode['config']) => void
}

export function CreateFolderConfigModal({ nodeId, workspaceTree, onClose, onSave }: CreateFolderConfigModalProps) {
  const {
    folderName, setFolderName,
    parentFolderPath, setParentFolderPath,
    ifExists, setIfExists,
    selectedParentNode,
    validation,
    handleSave,
  } = useCreateFolderConfig({ nodeId, workspaceTree, onSave, onClose })

  const errorCount = Object.keys(validation.fieldErrors).length + validation.formErrors.length

  return (
    <Modal onClose={onClose} ariaLabel="Configure Create Folder">
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

        <ErrorBoundary fallback={(error) => <ConfigErrorPanel error={error} onClose={onClose} />}>
          <div className="flex flex-col gap-4 p-4">
            <FolderNameField
              value={folderName}
              onChange={setFolderName}
              error={validation.fieldErrors.folderName}
            />
            <ParentFolderField
              workspaceTree={workspaceTree}
              selectedPath={parentFolderPath}
              selectedNode={selectedParentNode}
              onSelect={(node) => {
                setParentFolderPath(node.path)
              }}
              error={validation.fieldErrors.parentFolderPath}
            />
            <IfExistsField
              value={ifExists}
              onChange={setIfExists}
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
