'use client'

import { useCallback, useState } from 'react'
import type { FileTreeNode } from '@/lib/types/explore'
import type { WorkflowDefinition } from '@/lib/types/workflow'
import { SandboxOnboarding } from './SandboxOnboarding'
import { WorkflowEditor } from './WorkflowEditor'
import { ProjectInfoModal } from './ProjectInfoModal'
import { OpenRouterKeyProvider } from '@/lib/workflow/stores/openRouterKey'
import { PREBUILT_WORKFLOWS, type PrebuiltWorkflow } from '@/lib/workflow/prebuiltWorkflows'

type WorkspaceState = {
  path: string
  tree: FileTreeNode
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

function WorkflowCard({
  workflow,
  onLoad,
}: {
  workflow: PrebuiltWorkflow
  onLoad: (wf: PrebuiltWorkflow) => void
}) {
  return (
    <div
      className="flex flex-col rounded-xl border border-white/[0.06] px-5 py-4 transition-colors duration-300 hover:border-orange-500/20 hover:bg-orange-500/[0.03]"
      style={{ background: 'rgba(255,255,255,0.015)' }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-white/80">{workflow.name}</p>
        <div className="flex shrink-0 gap-1.5">
          <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-xs text-white/35">
            {workflow.nodeCount} nodes
          </span>
          {workflow.requiresApiKey && (
            <span className="rounded-md bg-orange-500/10 px-2 py-0.5 text-xs text-orange-400/80">
              AI
            </span>
          )}
        </div>
      </div>
      <p className="mb-4 flex-1 text-xs leading-relaxed text-white/35">{workflow.description}</p>
      <button
        onClick={() => onLoad(workflow)}
        className="w-full cursor-pointer rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 text-xs font-medium text-white/50 transition-colors duration-150 hover:border-white/[0.16] hover:bg-white/[0.08] hover:text-white/70"
      >
        Load Workflow →
      </button>
    </div>
  )
}

function LandingPage({
  onNextStep,
  onSelectTemplate,
}: {
  onNextStep: (path: string, tree: FileTreeNode) => void
  onSelectTemplate: (wf: PrebuiltWorkflow) => void
}) {
  const [step, setStep] = useState<'intro' | 'setup'>('intro')
  const [formVersion, setFormVersion] = useState(0)
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>(undefined)

  const handleBack = useCallback(() => {
    setStep('intro')
    setSelectedVariant(undefined)
    setFormVersion(v => v + 1)
  }, [])

  const handleSelectTemplate = useCallback((wf: PrebuiltWorkflow) => {
    onSelectTemplate(wf)
    setSelectedVariant(wf.templateVariant)
    setStep('setup')
  }, [onSelectTemplate])

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

            <div className="grid w-full grid-cols-2 gap-3">
              {FEATURES.map(f => (
                <FeatureCard key={f.title} title={f.title} description={f.description} />
              ))}
            </div>

            <div className="my-10 flex w-full items-center gap-4">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-xs uppercase tracking-widest text-white/20">Try a Workflow</span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
              {PREBUILT_WORKFLOWS.map(wf => (
                <WorkflowCard key={wf.id} workflow={wf} onLoad={handleSelectTemplate} />
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
              templateVariant={selectedVariant}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function WorkspaceSection() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(null)
  const [pendingWorkflow, setPendingWorkflow] = useState<PrebuiltWorkflow | null>(null)

  const handleTreeRefresh = useCallback((tree: FileTreeNode) => {
    setWorkspace(w => (w ? { ...w, tree } : w))
  }, [])

  const handleNextStep = useCallback((path: string, tree: FileTreeNode) => {
    if (pendingWorkflow) {
      const resolved: WorkflowDefinition = JSON.parse(
        JSON.stringify(pendingWorkflow.definition).replaceAll('{{workspace}}', path),
      )
      setPendingWorkflow(w => (w ? { ...w, definition: resolved } : w))
    }
    setWorkspace({ path, tree })
  }, [pendingWorkflow])

  if (workspace !== null) {
    return (
      <OpenRouterKeyProvider>
        <WorkflowEditor
          workspacePath={workspace.path}
          workspaceTree={workspace.tree}
          onTreeRefresh={handleTreeRefresh}
          initialWorkflow={pendingWorkflow?.definition}
        />
      </OpenRouterKeyProvider>
    )
  }

  return (
    <LandingPage
      onNextStep={handleNextStep}
      onSelectTemplate={setPendingWorkflow}
    />
  )
}
