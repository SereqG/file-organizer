'use client'

import { useCallback, useState } from 'react'
import type { FileTreeNode } from '@/lib/types/explore'
import { SandboxOnboarding } from './SandboxOnboarding'
import { WorkflowEditor } from './WorkflowEditor'
import { ProjectInfoModal } from './ProjectInfoModal'
import { OpenRouterKeyProvider } from '@/lib/workflow/stores/openRouterKey'

type WorkspaceState = {
  path: string
  tree: FileTreeNode
  sessionId: string
} | null

const FEATURES = [
  {
    title: 'Visual Workflow Editor',
    description:
      'Build file-processing pipelines with a drag-and-drop node editor. Connect triggers, filters, and actions visually.',
  },
  {
    title: 'AI-Powered Classification',
    description:
      'Analyse file content with LLM nodes. Automatically categorise documents, images, and code using natural language rules.',
  },
  {
    title: 'Safe Dry-Run Preview',
    description:
      'Every workflow can be previewed before execution. See exactly which files will be moved, renamed, or deleted.',
  },
  {
    title: 'Rule-Based Sorting',
    description:
      'Define deterministic sorting rules by extension, name, size, or date. No AI needed for simple, repeatable tasks.',
  },
  {
    title: 'Resumable Execution',
    description:
      'Long-running organiser jobs can be paused and resumed. Progress is tracked per session so nothing is lost.',
  },
  {
    title: 'Modular & Extensible',
    description:
      'Every node is an independent slice of logic. Add custom nodes or swap providers without touching the rest of the workflow.',
  },
]

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div
      className="rounded-xl border border-white/[0.06] px-5 py-4 transition-colors duration-300 hover:border-orange-500/20 hover:bg-orange-500/[0.03]"
      style={{ background: 'rgba(255,255,255,0.015)' }}
    >
      <p className="mb-1.5 text-sm font-medium text-white/80">{title}</p>
      <p className="text-xs leading-relaxed text-white/35">{description}</p>
    </div>
  )
}

function LandingPage({
  onNextStep,
}: {
  onNextStep: (path: string, tree: FileTreeNode, sessionId: string) => void
}) {
  const [step, setStep] = useState<'intro' | 'setup'>('intro')
  const [formVersion, setFormVersion] = useState(0)

  const handleBack = useCallback(() => {
    setStep('intro')
    setFormVersion(v => v + 1)
  }, [])

  return (
    <div className="relative flex w-full flex-col items-center">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="animate-glow-pulse absolute left-1/2 top-0 -translate-x-1/2 rounded-full"
          style={{
            width: 700,
            height: 700,
            background:
              'radial-gradient(circle, rgba(249,115,22,0.09) 0%, transparent 65%)',
          }}
        />
        <div
          className="animate-glow-pulse-delayed absolute -left-24 bottom-1/3 rounded-full"
          style={{
            width: 400,
            height: 400,
            background:
              'radial-gradient(circle, rgba(249,115,22,0.055) 0%, transparent 65%)',
          }}
        />
        <div
          className="animate-glow-pulse absolute -right-20 top-1/3 rounded-full"
          style={{
            width: 320,
            height: 320,
            background:
              'radial-gradient(circle, rgba(249,115,22,0.045) 0%, transparent 65%)',
          }}
        />
        {/* dot grid */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center px-6 py-20">
        {/* Hero text */}
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-white">
            File{' '}
            <span
              className="text-orange-400"
              style={{ textShadow: '0 0 40px rgba(249,115,22,0.5)' }}
            >
              Organizer
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/45">
            Build intelligent file-organisation pipelines using a visual node
            editor. Combine deterministic rules with AI-powered classification to
            automate how your files are sorted, renamed, and moved.
          </p>
        </div>

        {step === 'intro' ? (
          <>
            <div className="my-10 flex w-full items-center gap-4">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-xs uppercase tracking-widest text-white/20">Capabilities</span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(f => (
                <FeatureCard key={f.title} title={f.title} description={f.description} />
              ))}
            </div>

            <button
              onClick={() => setStep('setup')}
              className="mt-12 rounded-xl bg-orange-500 px-10 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-orange-400 hover:shadow-[0_0_32px_rgba(249,115,22,0.35)] cursor-pointer"
            >
              Get Started
            </button>
          </>
        ) : (
          <div className="mt-12 w-full">
            <SandboxOnboarding
              key={formVersion}
              onNextStep={onNextStep}
              onBack={handleBack}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function WorkspaceSection() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(null)

  const handleTreeRefresh = useCallback((tree: FileTreeNode) => {
    setWorkspace(w => (w ? { ...w, tree } : w))
  }, [])

  if (workspace !== null) {
    // The provider wraps WorkflowEditor (not nested inside it) because useWorkflowSimulation runs in
    // WorkflowEditor's body — above the providers WorkflowEditor renders internally.
    return (
      <OpenRouterKeyProvider>
        <WorkflowEditor
          workspacePath={workspace.path}
          workspaceTree={workspace.tree}
          sessionId={workspace.sessionId}
          onTreeRefresh={handleTreeRefresh}
        />
      </OpenRouterKeyProvider>
    )
  }

  return (
    <LandingPage
      onNextStep={(path, tree, sessionId) => setWorkspace({ path, tree, sessionId })}
    />
  )
}
