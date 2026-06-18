'use client'

import { Modal } from '@/components/shared/Modal'

interface DryRunInfoModalProps {
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

export function DryRunInfoModal({ onClose }: DryRunInfoModalProps) {
  return (
    <Modal onClose={onClose} ariaLabel="About Dry Run">
      <div
        className="mx-4 flex w-full max-w-sm flex-col rounded-2xl border border-white/[0.08] p-6"
        style={{ background: 'rgba(12, 12, 12, 0.97)', backdropFilter: 'blur(24px)', maxHeight: '80vh' }}
      >
        <h2 className="mb-1 text-base font-semibold text-white">About Dry Run</h2>
        <p className="mb-5 text-sm text-white/40">How simulation works in this editor.</p>

        <div className="min-h-0 flex-1 overflow-y-auto flex flex-col gap-4">
          <Section title="What is a dry run?">
            A dry run simulates the workflow without making any real changes to your files or
            folders. The engine walks every node in order and predicts what each one would do —
            nothing is actually written to disk.
          </Section>

          <Section title="What you see in the preview">
            After a dry run you get a list of predicted operations (create, move, rename, delete…)
            and the resulting folder structure as it would look once the workflow completes. Conflicts
            and failures are detected here, before anything changes.
          </Section>

          <Section title="Dry run in node config modals">
            When you open a node&apos;s configuration the editor automatically dry-runs all the nodes
            that come <em className="text-white/60 not-italic font-medium">before</em> it. This gives
            the path pickers an accurate view of the workspace at that point — including folders
            created by upstream nodes, moved files, and renamed items.
            <br /><br />
            Use <span className="font-medium text-white/80">Dry run previous nodes</span> to refresh
            that view after you change something upstream while this modal is open.
          </Section>

          <Section title="Dry Run Only mode">
            When enabled in settings, clicking Run shows the preview without actually executing the
            workflow. Use this to audit or test a workflow safely before committing to real changes.
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
