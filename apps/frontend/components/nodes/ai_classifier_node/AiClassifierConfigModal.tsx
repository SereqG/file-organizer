'use client'

import { useState } from 'react'
import {
  LuChevronUp,
  LuChevronDown,
  LuX,
  LuTriangle,
} from 'react-icons/lu'
import type { AiClassifierNode } from '@/lib/types/workflow'
import { useAiClassifierConfig } from '@/hooks/useAiClassifierConfig'
import { useCategoryLibrary } from '@/lib/workflow/stores/categoryLibrary'
import { CategoryLibraryPicker } from './CategoryLibraryPicker'
import { CreateCategoryModal } from './CreateCategoryModal'
import { Modal } from '@/components/shared/Modal'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { ConfigErrorPanel } from '@/components/shared/ConfigErrorPanel'
import { ActionButtons } from '../create_folder_node/ActionButtons'
import { ValidationMessages } from '../create_folder_node/ValidationMessages'

interface AiClassifierConfigModalProps {
  nodeId: string
  onClose: () => void
  onSave: (config: AiClassifierNode['config']) => void
}

export function AiClassifierConfigModal({
  nodeId,
  onClose,
  onSave,
}: AiClassifierConfigModalProps) {
  const {
    categoryIds,
    toggleCategory,
    moveCategoryUp,
    moveCategoryDown,
    removeCategory,
    allowDuplicate,
    setAllowDuplicate,
    validation,
    handleSave,
  } = useAiClassifierConfig({ nodeId, onSave, onClose })

  const {
    allCategories,
    getCategoryById,
    isNameTaken,
    createCategory,
    copyPredefined,
  } = useCategoryLibrary()

  const [showPicker, setShowPicker] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const errorCount =
    Object.keys(validation.fieldErrors).length + validation.formErrors.length

  return (
    <>
      <Modal onClose={onClose} ariaLabel="Configure AI Classifier">
        <div className="w-[520px] flex flex-col rounded-xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-blue-500/30 to-purple-600/30 border border-purple-500/30 text-purple-300 text-[10px]">
                ✦
              </div>
              <span className="text-sm font-medium text-white/80">Configure AI Classifier</span>
            </div>
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M1 1l10 10M11 1L1 11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <ErrorBoundary fallback={(error) => <ConfigErrorPanel error={error} onClose={onClose} />}>
            <div className="flex flex-col gap-4 p-4 overflow-y-auto max-h-[70vh]">
              {/* Categories section */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-white/60">Categories</label>
                  <button
                    type="button"
                    onClick={() => setShowPicker((v) => !v)}
                    className="text-[11px] text-purple-400/80 hover:text-purple-300 transition-colors"
                  >
                    {showPicker ? 'Done' : 'Add from library'}
                  </button>
                </div>

                {/* Selected categories list */}
                {categoryIds.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {categoryIds.map((id, i) => {
                      const cat = getCategoryById(id)
                      const isOrphaned = !cat
                      return (
                        <div
                          key={id}
                          className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${
                            isOrphaned
                              ? 'border-amber-500/40 bg-amber-500/5'
                              : 'border-white/10 bg-white/[0.03]'
                          }`}
                        >
                          {isOrphaned ? (
                            <LuTriangle size={12} className="text-amber-400 flex-shrink-0" />
                          ) : null}
                          <span
                            className={`flex-1 text-xs truncate ${
                              isOrphaned ? 'text-amber-300/70' : 'text-white/80'
                            }`}
                          >
                            {cat?.name ?? `Unknown (${id})`}
                          </span>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => moveCategoryUp(id)}
                              disabled={i === 0}
                              className="text-white/30 hover:text-white/60 disabled:opacity-20 transition-colors"
                            >
                              <LuChevronUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveCategoryDown(id)}
                              disabled={i === categoryIds.length - 1}
                              className="text-white/30 hover:text-white/60 disabled:opacity-20 transition-colors"
                            >
                              <LuChevronDown size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCategory(id)}
                              className="text-white/30 hover:text-rose-400/70 transition-colors ml-0.5"
                            >
                              <LuX size={11} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {categoryIds.length === 0 && !showPicker && (
                  <p className="text-[11px] text-white/30">
                    No categories selected. Click "Add from library" to choose.
                  </p>
                )}

                {validation.fieldErrors.categoryIds && (
                  <span className="text-[11px] text-rose-400/80">
                    {validation.fieldErrors.categoryIds}
                  </span>
                )}

                {/* Category picker */}
                {showPicker && (
                  <CategoryLibraryPicker
                    allCategories={allCategories}
                    selectedIds={categoryIds}
                    onToggle={toggleCategory}
                    onCopyPredefined={copyPredefined}
                    onCreateNew={() => setShowCreateModal(true)}
                  />
                )}
              </div>

              {/* Allow duplicate toggle */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-white/70">Allow multiple categories</span>
                  <span className="text-[10px] text-white/35">
                    When off, each item goes to the single best-matching category
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowDuplicate}
                  onClick={() => setAllowDuplicate((v) => !v)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    allowDuplicate ? 'bg-purple-600/80' : 'bg-white/15'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      allowDuplicate ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <p className="text-[11px] text-white/40">
                Each category gets its own output handle. Items that match no category flow to the
                <span className="text-white/60"> unclassified </span>
                handle.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
              <ValidationMessages errorCount={errorCount} />
              <ActionButtons
                onCancel={onClose}
                onSave={handleSave}
                saveDisabled={!validation.valid}
              />
            </div>
          </ErrorBoundary>
        </div>
      </Modal>

      {showCreateModal && (
        <CreateCategoryModal
          isNameTaken={isNameTaken}
          onCreate={createCategory}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </>
  )
}
