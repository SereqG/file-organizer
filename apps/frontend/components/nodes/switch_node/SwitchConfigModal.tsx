'use client'

import { useMemo, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  MAX_SWITCH_CASES,
  MIN_SWITCH_CASES,
  type ConditionGroup,
  type MissingFieldStrategy,
  type SwitchCase,
  type SwitchNode,
} from '@/lib/types/workflow'
import { nextId } from '@/lib/workflow/utils/nextId'
import { switchOutputColor } from '@/lib/workflow/utils/switchColors'
import { validateSwitchConfig } from '@/lib/workflow/validation/validateSwitchConfig'
import { ConditionGroupEditor } from '../if_node/ConditionBuilder/ConditionGroupEditor'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { ConfigErrorPanel } from '@/components/shared/ConfigErrorPanel'
import { Modal } from '@/components/shared/Modal'
import { LuPlus, LuTrash2 } from 'react-icons/lu'

interface SwitchConfigModalProps {
  nodeId: string
  onClose: () => void
  onSave: (config: SwitchNode['config']) => void
}

const STRATEGY_LABELS: Record<MissingFieldStrategy, string> = {
  false: 'Treat as false (recommended)',
  error: 'Raise an error',
  skip: 'Skip the item',
}

function emptyCase(): SwitchCase {
  return { id: nextId('case'), conditions: { id: nextId('group'), operator: 'AND', children: [] } }
}

export function SwitchConfigModal({ nodeId, onClose, onSave }: SwitchConfigModalProps) {
  const { getNode } = useReactFlow()
  const initial = useMemo<SwitchNode['config']>(() => {
    const node = getNode(nodeId)
    const stored = (node?.data as { config?: SwitchNode['config'] } | undefined)?.config
    return stored ?? { cases: [emptyCase(), emptyCase()] }
  }, [getNode, nodeId])

  const [cases, setCases] = useState<SwitchCase[]>(initial.cases)
  const [strategy, setStrategy] = useState<MissingFieldStrategy>(initial.missingFieldStrategy ?? 'false')

  const validation = useMemo(() => validateSwitchConfig({ cases, missingFieldStrategy: strategy }), [cases, strategy])

  const updateCase = (index: number, conditions: ConditionGroup) => {
    setCases((prev) => prev.map((c, i) => (i === index ? { ...c, conditions } : c)))
  }

  const addCase = () => {
    setCases((prev) => (prev.length >= MAX_SWITCH_CASES ? prev : [...prev, emptyCase()]))
  }

  const removeCase = (index: number) => {
    setCases((prev) => (prev.length <= MIN_SWITCH_CASES ? prev : prev.filter((_, i) => i !== index)))
  }

  const handleSave = () => {
    if (!validation.valid) return
    onSave({ cases, missingFieldStrategy: strategy })
    onClose()
  }

  const errorCount = Object.keys(validation.fieldErrors).length + validation.formErrors.length

  return (
    <Modal onClose={onClose} ariaLabel="Configure Switch">
      <div className="w-[640px] max-h-[85vh] flex flex-col rounded-xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-medium text-white/80">Configure Switch</span>
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
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {cases.map((switchCase, index) => (
              <div key={switchCase.id} className="rounded-lg border border-white/10 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-medium text-white/70">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: switchOutputColor(index) }} />
                    Output {index + 1}
                  </span>
                  <button
                    onClick={() => removeCase(index)}
                    disabled={cases.length <= MIN_SWITCH_CASES}
                    className="flex h-6 w-6 items-center justify-center rounded text-white/40 transition-colors hover:bg-white/10 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Remove output ${index + 1}`}
                  >
                    <LuTrash2 size={12} />
                  </button>
                </div>
                <ConditionGroupEditor
                  group={switchCase.conditions}
                  path={`cases[${index}].conditions`}
                  depth={0}
                  errors={validation.fieldErrors}
                  onChange={(next) => updateCase(index, next)}
                />
              </div>
            ))}

            <button
              onClick={addCase}
              disabled={cases.length >= MAX_SWITCH_CASES}
              className="flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-orange-500/60 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <LuPlus size={12} /> Add output
            </button>

            <div className="mt-2 flex items-center gap-2 text-xs text-white/60">
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

            <p className="text-[11px] text-white/40">
              Items flow to every output whose condition matches; items matching none go to the
              <span className="text-white/60"> else </span>
              output.
            </p>
          </div>
        </ErrorBoundary>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
          {!validation.valid && (
            <span className="mr-auto text-[11px] text-rose-400/80">
              {validation.formErrors[0] ?? `${errorCount} validation ${errorCount === 1 ? 'error' : 'errors'}`}
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
