'use client'

import { useState } from 'react'
import { LuInfo } from 'react-icons/lu'
import { Modal } from '@/components/shared/Modal'
import { DryRunInfoModal } from '@/components/DryRunInfoModal'
import { ApiKeyInfoModal } from '@/components/ApiKeyInfoModal'
import { useOpenRouterKey } from '@/lib/workflow/stores/openRouterKey'

interface RunSettingsModalProps {
  isDryRunOnly: boolean
  onToggleDryRunOnly: (value: boolean) => void
  onClose: () => void
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
        checked ? 'bg-emerald-500' : 'bg-white/15'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export function RunSettingsModal({ isDryRunOnly, onToggleDryRunOnly, onClose }: RunSettingsModalProps) {
  const [infoOpen, setInfoOpen] = useState(false)
  const [keyInfoOpen, setKeyInfoOpen] = useState(false)
  const { apiKey, isEnabled, setApiKey, setIsEnabled } = useOpenRouterKey()

  return (
    <>
    <Modal onClose={onClose} ariaLabel="Run settings">
      <div
        className="mx-4 flex w-full max-w-sm flex-col rounded-2xl border border-white/[0.08] p-6"
        style={{ background: 'rgba(12, 12, 12, 0.95)', backdropFilter: 'blur(24px)' }}
      >
        <h2 className="mb-1 text-base font-semibold text-white">Run Settings</h2>
        <p className="mb-5 text-sm text-white/40">Configure how the workflow executes.</p>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-white">Dry Run Only</p>
              <button
                onClick={() => setInfoOpen(true)}
                className="flex h-4 w-4 items-center justify-center rounded text-white/30 transition-colors hover:text-white/60"
                aria-label="What is dry run?"
              >
                <LuInfo size={12} />
              </button>
            </div>
            <p className="mt-0.5 text-xs text-white/40">Preview changes without executing them.</p>
          </div>
          <Toggle checked={isDryRunOnly} onChange={onToggleDryRunOnly} />
        </div>

        <div className="mt-3 rounded-xl border border-white/[0.07] px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-white">OpenRouter API Key</p>
              <button
                onClick={() => setKeyInfoOpen(true)}
                className="flex h-4 w-4 items-center justify-center rounded text-white/30 transition-colors hover:text-white/60"
                aria-label="About the OpenRouter API key"
              >
                <LuInfo size={12} />
              </button>
            </div>
            <Toggle checked={isEnabled} onChange={setIsEnabled} />
          </div>
          <p className="mt-0.5 text-xs text-white/40">Required for AI nodes. Stored only in this browser.</p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-..."
            autoComplete="off"
            spellCheck={false}
            className="mt-2.5 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-white/90 placeholder:text-white/25 focus:border-white/25 focus:outline-none"
          />
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl border border-white/10 py-2.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/[0.04]"
        >
          Close
        </button>
      </div>
    </Modal>
    {infoOpen && <DryRunInfoModal onClose={() => setInfoOpen(false)} />}
    {keyInfoOpen && <ApiKeyInfoModal onClose={() => setKeyInfoOpen(false)} />}
    </>
  )
}
