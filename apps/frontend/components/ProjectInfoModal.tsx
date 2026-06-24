'use client'

import { LuX } from 'react-icons/lu'
import { Modal } from './shared/Modal'

interface ProjectInfoModalProps {
  onClose: () => void
}

const STEPS = [
  {
    number: '1',
    title: 'Pick a workspace folder',
    description: 'Browse your sandbox and select the root directory you want to organize.',
  },
  {
    number: '2',
    title: 'Add a Trigger node',
    description: 'Every workflow starts with a Trigger. Drag it from the sidebar or use the canvas button when the canvas is empty.',
  },
  {
    number: '3',
    title: 'Build your pipeline',
    description: 'Drag action nodes from the left sidebar onto the canvas, then draw connections between them to define execution order.',
  },
  {
    number: '4',
    title: 'Configure each node',
    description: 'Click the settings icon on any node to set its target files, destination folders, conditions, or AI categories.',
  },
  {
    number: '5',
    title: 'Dry-run first',
    description: 'Enable Dry Run in the run settings to preview every change before it is applied. No files are moved or deleted.',
  },
  {
    number: '6',
    title: 'Run the workflow',
    description: 'Hit Run to execute the pipeline. Watch the Logs panel for real-time progress and a full summary of results.',
  },
]

const NODES = [
  { name: 'Trigger', description: 'Starting point — launches the workflow and supplies the initial file tree to downstream nodes.' },
  { name: 'If', description: 'Branches flow on a condition: file extension, name, size, date, or AI classifier category.' },
  { name: 'Switch', description: 'Routes files to multiple labeled outputs based on a field value.' },
  { name: 'Move', description: 'Moves files or folders to a chosen destination.' },
  { name: 'Copy', description: 'Copies files or folders, with an option to keep or discard the original.' },
  { name: 'Rename File', description: 'Renames a file with configurable conflict-handling (skip, overwrite, or suffix).' },
  { name: 'Rename Folder', description: 'Renames a folder with the same conflict-handling options as Rename File.' },
  { name: 'Create Folder', description: 'Creates a new folder; configurable behavior when the folder already exists.' },
  { name: 'Delete File', description: 'Permanently removes files. In dry-run mode this is a safe no-op.' },
  { name: 'Delete Folder', description: 'Permanently removes folders. In dry-run mode this is a safe no-op.' },
  { name: 'AI Classifier', description: 'Classifies files by content using an AI model and attaches a category label that If/Switch nodes can test.' },
]

const TIPS = [
  'Use the Workflow Library (book icon, top-left of the canvas) to save and reload workflow presets.',
  'Re-explore refreshes the file tree after changes made outside the app.',
  'The Logs panel shows detailed execution output including per-file dry-run previews.',
  'Always dry-run first before executing a workflow on a folder you care about.',
  'AI Classifier results are cached per file — re-runs are fast for files that have not changed.',
]

export function ProjectInfoModal({ onClose }: ProjectInfoModalProps) {
  return (
    <Modal onClose={onClose} ariaLabel="Project information and user guide">
      <div className="relative mx-4 w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0e0e0e] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/[0.06] px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-white">File Organizer</h2>
            <p className="mt-0.5 text-sm text-white/40">User guide</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70"
            aria-label="Close"
          >
            <LuX size={15} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-8">
          <section>
            <p className="text-sm leading-relaxed text-white/55">
              File Organizer is a visual workflow editor for automating file management. Build
              pipelines by connecting nodes on a canvas — combine deterministic rules with
              AI-powered classification to sort, rename, move, and delete files automatically.
              Every workflow can be previewed with a dry run before any real changes are applied.
            </p>
          </section>

          <section>
            <h3 className="mb-4 text-xs font-medium uppercase tracking-widest text-white/25">How to use</h3>
            <div className="space-y-4">
              {STEPS.map(step => (
                <div key={step.number} className="flex gap-4">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-[10px] font-semibold text-orange-400">
                    {step.number}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white/80">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/40">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-xs font-medium uppercase tracking-widest text-white/25">Available nodes</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {NODES.map(node => (
                <div
                  key={node.name}
                  className="rounded-lg border border-white/[0.06] px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.012)' }}
                >
                  <p className="text-sm font-medium text-white/75">{node.name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/35">{node.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="pb-1">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-white/25">Tips</h3>
            <ul className="space-y-2.5">
              {TIPS.map(tip => (
                <li key={tip} className="flex items-start gap-2.5 text-xs leading-relaxed text-white/40">
                  <span className="mt-[5px] size-1 shrink-0 rounded-full bg-orange-500/50" />
                  {tip}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </Modal>
  )
}
