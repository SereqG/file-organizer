'use client'

import { Modal } from '@/components/shared/Modal'

interface ApiKeyInfoModalProps {
  onClose: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/40">{title}</p>
      <div className="text-sm text-white/70 leading-relaxed">{children}</div>
    </div>
  )
}

export function ApiKeyInfoModal({ onClose }: ApiKeyInfoModalProps) {
  return (
    <Modal onClose={onClose} ariaLabel="About the OpenRouter API key">
      <div
        className="mx-4 flex w-full max-w-sm flex-col rounded-2xl border border-white/[0.08] p-6"
        style={{ background: 'rgba(12, 12, 12, 0.97)', backdropFilter: 'blur(24px)', maxHeight: '80vh' }}
      >
        <h2 className="mb-1 text-base font-semibold text-white">OpenRouter API Key</h2>
        <p className="mb-5 text-sm text-white/40">Why we ask for it and how to get one.</p>

        <div className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-4">
          <Section title="How your key is handled">
            Your key is stored <span className="font-medium text-white/80">only in this browser</span>
            {' '}(localStorage). We never save it on our servers — it is sent only alongside
            <em className="text-white/60 not-italic font-medium"> your own </em> workflow runs so the
            AI Classifier can call OpenRouter on your behalf. This is a demo: bring your own key, and
            remove it any time by clearing the field.
          </Section>

          <Section title="How to get a key">
            Create an account at{' '}
            <a
              href="https://openrouter.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white/80 underline decoration-white/30 hover:decoration-white/60"
            >
              openrouter.ai
            </a>
            , then open{' '}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white/80 underline decoration-white/30 hover:decoration-white/60"
            >
              openrouter.ai/keys
            </a>
            , create a new key, and paste it into the field. Toggle the switch on to enable the AI
            Classifier node.
          </Section>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl border border-white/10 py-2.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/[0.04]"
        >
          Got it
        </button>
      </div>
    </Modal>
  )
}
