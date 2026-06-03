'use client'

import { Modal } from '@/components/shared/Modal'
import { ExecutionWarningsList } from './ExecutionWarningsList'
import type { WorkflowPreview } from '@/lib/types/workflow'

// Colour accent per action kind so the list scans quickly.
const KIND_STYLES: Record<string, string> = {
  create: 'text-emerald-300 border-emerald-500/30',
  delete: 'text-red-300 border-red-500/30',
  rename: 'text-sky-300 border-sky-500/30',
  reuse: 'text-white/50 border-white/15',
  move: 'text-violet-300 border-violet-500/30',
  copy: 'text-amber-300 border-amber-500/30',
  skip: 'text-white/40 border-white/10',
}

interface WorkflowPreviewModalProps {
  preview: WorkflowPreview
  onConfirm: () => void
  onCancel: () => void
}

export function WorkflowPreviewModal({ preview, onConfirm, onCancel }: WorkflowPreviewModalProps) {
  const { ok, error, actions, warnings } = preview

  return (
    <Modal onClose={onCancel} ariaLabel="Review workflow changes">
      <div
        className="mx-4 flex w-full max-w-md flex-col rounded-2xl border border-white/[0.08] p-6"
        style={{ background: 'rgba(12, 12, 12, 0.95)', backdropFilter: 'blur(24px)', maxHeight: '80vh' }}
      >
        <h2 className="mb-1 text-base font-semibold text-white">Review changes</h2>
        <p className="mb-4 text-sm text-white/40">
          {ok
            ? `${actions.length} ${actions.length === 1 ? 'operation' : 'operations'} will run. Nothing has changed yet.`
            : 'This workflow would fail before completing.'}
        </p>

        {error && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300 break-words">
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {actions.length > 0 && (
            <ul className="space-y-1">
              {actions.map((action, index) => (
                <li key={index} className="flex items-center gap-2 text-xs">
                  <span
                    className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${KIND_STYLES[action.kind] ?? 'text-white/40 border-white/10'}`}
                  >
                    {action.kind}
                  </span>
                  <span className="truncate text-white/60" title={action.description}>
                    {action.description}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {actions.length === 0 && !error && (
            <p className="text-xs text-white/40">No filesystem changes — the workflow only routes items.</p>
          )}
          <ExecutionWarningsList warnings={warnings} />
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/[0.04]"
          >
            Cancel
          </button>
          {ok && (
            <button
              onClick={onConfirm}
              className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
            >
              Confirm &amp; Run
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
