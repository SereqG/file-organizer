'use client'

import { Modal } from '@/components/shared/Modal'
import type { PendingDecision } from '@/lib/types/workflow'

// Friendly labels for the collision-resolution options the engine offers.
const OPTION_LABELS: Record<string, string> = {
  overwrite: 'Overwrite',
  rename_incrementally: 'Keep both',
  skip: 'Skip',
  fail: 'Stop run',
}

const DEFAULT_OPTIONS = ['overwrite', 'rename_incrementally', 'skip', 'fail']

interface DecisionModalProps {
  decision: PendingDecision
  onChoose: (option: string) => void
  onCancel: () => void
}

export function DecisionModal({ decision, onChoose, onCancel }: DecisionModalProps) {
  const options = decision.options && decision.options.length > 0 ? decision.options : DEFAULT_OPTIONS

  return (
    <Modal onClose={onCancel} ariaLabel="Resolve conflict">
      <div
        className="mx-4 w-full max-w-sm rounded-2xl border border-white/[0.08] p-6"
        style={{ background: 'rgba(12, 12, 12, 0.95)', backdropFilter: 'blur(24px)' }}
      >
        <h2 className="mb-2 text-base font-semibold text-white">Resolve conflict</h2>
        <p className="mb-1 text-sm text-white/50">
          {decision.message ?? 'A destination already exists. Choose how to continue.'}
        </p>
        {decision.targetPath && (
          <p className="mb-4 truncate font-mono text-xs text-white/40" title={decision.targetPath}>
            {decision.targetPath}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => onChoose(option)}
              className="w-full rounded-xl border border-white/10 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.06]"
            >
              {OPTION_LABELS[option] ?? option}
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="mt-4 w-full rounded-xl py-2 text-xs font-medium text-white/40 transition-colors hover:text-white/70"
        >
          Cancel run
        </button>
      </div>
    </Modal>
  )
}
