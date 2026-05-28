'use client'

import { Modal } from '@/components/shared/Modal'

export type TriggerId = 'manual' | 'schedule'

interface TriggerOption {
  id: TriggerId
  label: string
  description: string
  icon: React.ReactNode
}

const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    id: 'manual',
    label: 'Manual Trigger',
    description: 'Start the workflow by hand',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 3.5V10L8 8H13L6 3.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M8 8L10.5 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'schedule',
    label: 'Schedule',
    description: 'Run on a recurring time interval',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M9 5.5V9L11 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

interface TriggerSelectModalProps {
  onSelect: (id: TriggerId) => void
  onClose: () => void
}

export function TriggerSelectModal({ onSelect, onClose }: TriggerSelectModalProps) {
  return (
    <Modal onClose={onClose} ariaLabel="Select trigger">
      <div className="w-80 rounded-xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-medium text-white/80">Select trigger</span>
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

        <div className="flex flex-col gap-1 p-2">
          {TRIGGER_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/5"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/60">
                {option.icon}
              </span>
              <div>
                <div className="text-sm text-white/80">{option.label}</div>
                <div className="text-xs text-white/40">{option.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}
