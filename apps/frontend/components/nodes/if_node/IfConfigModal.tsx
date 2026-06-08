'use client'

import { useMemo, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { ConditionGroup, IfNode, MissingFieldStrategy } from '@/lib/types/workflow'
import { nextId } from '@/lib/workflow/utils/nextId'
import { validateIfConfig } from '@/lib/workflow/validation/validateIfConfig'
import { ConditionGroupEditor } from './ConditionBuilder/ConditionGroupEditor'
import { EvaluationPreview } from './ConditionBuilder/EvaluationPreview'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { ConfigErrorPanel } from '@/components/shared/ConfigErrorPanel'
import { Modal } from '@/components/shared/Modal'


interface IfConfigModalProps {
  nodeId: string
  onClose: () => void
  onSave: (config: IfNode['config']) => void
}

const STRATEGY_LABELS: Record<MissingFieldStrategy, string> = {
  false: 'Treat as false (recommended)',
  error: 'Raise an error',
  skip: 'Skip the item',
}

function rootGroup(): ConditionGroup {
  return { id: nextId('group'), operator: 'AND', children: [] }
}

export function IfConfigModal({ nodeId, onClose, onSave }: IfConfigModalProps) {
  const { getNode } = useReactFlow()
  const initial = useMemo<IfNode['config']>(() => {
    const node = getNode(nodeId)
    const stored = (node?.data as { config?: IfNode['config'] } | undefined)?.config
    return stored ?? { conditions: rootGroup() }
  }, [getNode, nodeId])

  const [conditions, setConditions] = useState<ConditionGroup>(initial.conditions)
  const [strategy, setStrategy] = useState<MissingFieldStrategy>(initial.missingFieldStrategy ?? 'false')

  const validation = useMemo(() => validateIfConfig(conditions), [conditions])

  const handleSave = () => {
    if (!validation.valid) return
    onSave({ conditions, missingFieldStrategy: strategy })
    onClose()
  }

  return (
    <Modal onClose={onClose} ariaLabel="Configure If">
      <div className="w-[640px] max-h-[85vh] flex flex-col rounded-xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-medium text-white/80">Configure If</span>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <ErrorBoundary fallback={(error) => <ConfigErrorPanel error={error} onClose={onClose} />}>
          <div className="flex-1 overflow-auto p-4">
            <ConditionGroupEditor
              group={conditions}
              path="conditions"
              depth={0}
              errors={validation.fieldErrors}
              onChange={setConditions}
            />

            <div className="mt-4 flex items-center gap-2 text-xs text-white/60">
              <label htmlFor="missing-strategy">When a field is missing:</label>
              <select
                id="missing-strategy"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as MissingFieldStrategy)}
                className="rounded-md border border-white/10 bg-[#181818] px-2 py-1 text-xs text-white/80 focus:border-orange-500/60 focus:outline-none"
              >
                {(Object.keys(STRATEGY_LABELS) as MissingFieldStrategy[]).map((s) => (
                  <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <EvaluationPreview conditions={conditions} strategy={strategy} />
            <div className="mt-4">
            </div>
          </div>
        </ErrorBoundary>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
          {!validation.valid && (
            <span className="mr-auto text-[11px] text-rose-400/80">
              {Object.keys(validation.fieldErrors).length + validation.formErrors.length} validation {Object.keys(validation.fieldErrors).length + validation.formErrors.length === 1 ? 'error' : 'errors'}
            </span>
          )}
          <button
            onClick={onClose}
            className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/70 transition-colors hover:border-white/30 hover:text-white/90"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!validation.valid}
            className="rounded-md border border-orange-500/60 bg-orange-500/15 px-3 py-1 text-xs text-orange-300 transition-colors hover:bg-orange-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}
