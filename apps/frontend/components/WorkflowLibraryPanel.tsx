'use client'

import { useCallback, useEffect, useState } from 'react'
import { LuX, LuTrash2, LuDownload, LuChevronDown, LuChevronRight } from 'react-icons/lu'
import type { WorkflowDefinition } from '@/lib/types/workflow'
import type { RunHistoryEntry, SavedWorkflowSummary } from '@/lib/types/persistence'
import { useWorkflowLibrary } from '@/hooks/useWorkflowLibrary'

interface WorkflowLibraryPanelProps {
  onClose: () => void
  canSave: boolean
  // The current canvas definition with node positions merged in, or null when there is nothing to save.
  buildSaveDefinition: () => WorkflowDefinition | null
  // Hydrate the canvas from a loaded definition.
  onApplyDefinition: (definition: WorkflowDefinition) => void
}

function formatTime(epochSeconds: number | null): string {
  if (!epochSeconds) return '—'
  return new Date(epochSeconds * 1000).toLocaleString()
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-emerald-400',
  failed: 'text-red-400',
  cancelled: 'text-amber-400',
  running: 'text-sky-400',
}

function SaveForm({ canSave, onSave }: { canSave: boolean; onSave: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    const ok = await onSave(trimmed)
    setSaving(false)
    if (ok) setName('')
  }, [name, saving, onSave])

  return (
    <div className="flex gap-2 px-4 py-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
        placeholder={canSave ? 'Name this workflow…' : 'Add a trigger to save'}
        disabled={!canSave}
        className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/80
          placeholder:text-white/25 focus:border-orange-400/40 focus:outline-none disabled:opacity-40"
      />
      <button
        onClick={() => void submit()}
        disabled={!canSave || !name.trim() || saving}
        className="rounded-lg border border-orange-400/30 bg-orange-500/10 px-3 py-1.5 text-xs font-medium
          text-orange-200 transition-colors hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Save
      </button>
    </div>
  )
}

function SavedRow({ item, onLoad, onDelete }: {
  item: SavedWorkflowSummary
  onLoad: () => void
  onDelete: () => void
}) {
  return (
    <div className="group flex items-center gap-2 px-4 py-2 hover:bg-white/[0.03]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-white/80" title={item.name}>{item.name}</p>
        <p className="text-[10px] text-white/30">{formatTime(item.updatedAt)}</p>
      </div>
      <button
        onClick={onLoad}
        className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-orange-300"
        aria-label="Load workflow" title="Load onto canvas"
      >
        <LuDownload size={13} />
      </button>
      <button
        onClick={onDelete}
        className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-red-400"
        aria-label="Delete workflow" title="Delete"
      >
        <LuTrash2 size={13} />
      </button>
    </div>
  )
}

function RunRow({ run, getLog }: { run: RunHistoryEntry; getLog: (id: string) => Promise<string | null> }) {
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const toggle = useCallback(async () => {
    const next = !open
    setOpen(next)
    if (next && log === null) {
      setLoading(true)
      setLog((await getLog(run.id)) ?? 'No log available.')
      setLoading(false)
    }
  }, [open, log, getLog, run.id])

  const statusColor = STATUS_COLORS[run.status] ?? 'text-white/50'

  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button onClick={() => void toggle()} className="flex w-full items-center gap-1.5 px-4 py-2 text-left hover:bg-white/[0.03]">
        {open ? <LuChevronDown size={12} className="shrink-0 text-white/30" /> : <LuChevronRight size={12} className="shrink-0 text-white/30" />}
        <span className={`text-xs font-medium uppercase ${statusColor}`}>{run.status}</span>
        <span className="ml-auto text-[10px] text-white/30">{formatTime(run.startedAt)}</span>
      </button>
      {open && (
        <div className="px-4 pb-2">
          {run.summary && (
            <p className="mb-1 text-[10px] text-white/40">
              {run.summary.executedNodes ?? 0} node(s), {run.summary.warnings ?? 0} warning(s)
              {run.summary.error ? ` — ${run.summary.error}` : ''}
            </p>
          )}
          <pre className="max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/40 p-2 text-[10px] leading-relaxed text-white/60 whitespace-pre-wrap">
            {loading ? 'Loading…' : log}
          </pre>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/25 border-b border-white/5">
      {children}
    </div>
  )
}

export function WorkflowLibraryPanel({ onClose, canSave, buildSaveDefinition, onApplyDefinition }: WorkflowLibraryPanelProps) {
  const { definitions, runs, error, refresh, save, remove, load, getRun } = useWorkflowLibrary()

  useEffect(() => { void refresh() }, [refresh])

  const handleSave = useCallback(async (name: string) => {
    const definition = buildSaveDefinition()
    if (!definition) return false
    return save(name, definition)
  }, [buildSaveDefinition, save])

  const handleLoad = useCallback(async (id: string) => {
    const definition = await load(id)
    if (definition) {
      onApplyDefinition(definition)
      onClose()
    }
  }, [load, onApplyDefinition, onClose])

  const getLog = useCallback(async (id: string) => (await getRun(id))?.log ?? null, [getRun])

  return (
    <div className="fixed left-0 top-0 z-40 flex h-full w-80 flex-col border-r border-white/10 bg-[#0c0c0c]/95 backdrop-blur">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-medium text-white/80">Workflow Library</span>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white/80"
          aria-label="Close library panel"
        >
          <LuX size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && <p className="px-4 py-2 text-xs text-red-400">{error}</p>}

        <SaveForm canSave={canSave} onSave={handleSave} />

        <SectionHeader>Saved Workflows</SectionHeader>
        {definitions.length === 0
          ? <p className="px-4 py-4 text-xs text-white/30">No saved workflows yet.</p>
          : definitions.map((item) => (
              <SavedRow key={item.id} item={item} onLoad={() => void handleLoad(item.id)} onDelete={() => void remove(item.id)} />
            ))}

        <SectionHeader>Run History</SectionHeader>
        {runs.length === 0
          ? <p className="px-4 py-4 text-xs text-white/30">No runs yet.</p>
          : runs.map((run) => <RunRow key={run.id} run={run} getLog={getLog} />)}
      </div>
    </div>
  )
}
