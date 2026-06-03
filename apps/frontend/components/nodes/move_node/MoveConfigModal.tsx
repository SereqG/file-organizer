'use client'

import type { MoveFileNode } from '@/lib/types/workflow'
import type { FileTreeNode } from '@/lib/types/explore'
import { useMoveConfig } from '@/hooks/useMoveConfig'
import { FolderPicker } from '../create_folder_node/FolderPicker'
import { ValidationMessages } from '../create_folder_node/ValidationMessages'
import { ActionButtons } from '../create_folder_node/ActionButtons'
import { TransferIfExistsField } from './TransferIfExistsField'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { ConfigErrorPanel } from '@/components/shared/ConfigErrorPanel'
import { Modal } from '@/components/shared/Modal'

interface MoveConfigModalProps {
  nodeId: string
  workspaceTree: FileTreeNode
  onClose: () => void
  onSave: (config: MoveFileNode['config']) => void
}

export function MoveConfigModal({ nodeId, workspaceTree, onClose, onSave }: MoveConfigModalProps) {
  const {
    targetPath, setTargetPath,
    ifExists, setIfExists,
    selectedTargetNode,
    validation,
    handleSave,
  } = useMoveConfig({ nodeId, workspaceTree, onSave, onClose })

  const errorCount = Object.keys(validation.fieldErrors).length + validation.formErrors.length

  return (
    <Modal onClose={onClose} ariaLabel="Configure Move">
      <div className="w-[480px] flex flex-col rounded-xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-medium text-white/80">Configure Move</span>
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
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/60">Target folder</label>
              <FolderPicker
                root={workspaceTree}
                selectedPath={targetPath || null}
                onSelect={(node) => setTargetPath(node.path)}
              />
              {selectedTargetNode ? (
                <span title={selectedTargetNode.path} className="text-[11px] text-sky-400/70 font-mono truncate">
                  {selectedTargetNode.path}
                </span>
              ) : (
                <span className="text-[11px] text-white/25">Select a destination folder from the tree above</span>
              )}
              {validation.fieldErrors.targetPath && (
                <span className="text-[11px] text-rose-400/80">{validation.fieldErrors.targetPath}</span>
              )}
            </div>
            <TransferIfExistsField value={ifExists} onChange={setIfExists} />
          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
            <ValidationMessages errorCount={errorCount} />
            <ActionButtons onCancel={onClose} onSave={handleSave} saveDisabled={!validation.valid} />
          </div>
        </ErrorBoundary>
      </div>
    </Modal>
  )
}
