'use client'

import { useState } from 'react'
import type { ConditionGroup, MissingFieldStrategy, WorkflowItem } from '@/lib/types/workflow'
import { evaluateWithTrace, type TraceResult } from '@/lib/workflow/evaluator/explain'
import { validateWorkflowItem } from '@/lib/workflow/validateWorkflowItem'

interface EvaluationPreviewProps {
  conditions: ConditionGroup
  strategy: MissingFieldStrategy
}

const SAMPLE_ITEM: WorkflowItem = {
  id: 'sample-1',
  path: '/files/invoice.pdf',
  name: 'invoice.pdf',
  type: 'file',
  extension: '.pdf',
  mimeType: 'application/pdf',
  stat: {
    size: 2_500_000,
    createdAt: new Date(Date.now() - 86_400_000 * 3).toISOString(),
    modifiedAt: new Date(Date.now() - 86_400_000).toISOString(),
    accessedAt: new Date().toISOString(),
  },
  flags: { hidden: false, executable: false, readable: true, writable: true },
  ai: { category: 'invoice', language: 'en', confidence: 0.91 },
}

export function EvaluationPreview({ conditions, strategy }: EvaluationPreviewProps) {
  const [open, setOpen] = useState(false)
  const [json, setJson] = useState<string>(JSON.stringify(SAMPLE_ITEM, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<TraceResult | null>(null)

  const run = async () => {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON')
      setResult(null)
      return
    }

    const validated = validateWorkflowItem(parsed)
    if (!validated.ok) {
      setParseError(`Invalid WorkflowItem: ${validated.error}`)
      setResult(null)
      return
    }

    setParseError(null)
    try {
      const trace = await evaluateWithTrace(validated.item, conditions, { missingFieldStrategy: strategy })
      setResult(trace)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Evaluation failed')
      setResult(null)
    }
  }

  return (
    <div className="mt-4 rounded-md border border-white/10 bg-[#0d0d0d]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs text-white/70 hover:text-white/90"
      >
        <span>Evaluation preview</span>
        <span className="text-white/40">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-white/10 p-3">
          <label className="text-[11px] text-white/50">Sample WorkflowItem (JSON)</label>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={8}
            className="rounded border border-white/10 bg-[#181818] p-2 font-mono text-[11px] text-white/80 focus:border-orange-500/60 focus:outline-none"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={run}
              className="rounded-md border border-orange-500/60 bg-orange-500/15 px-3 py-1 text-xs text-orange-300 transition-colors hover:bg-orange-500/25"
            >
              Run preview
            </button>
            {parseError && <span className="text-[11px] text-rose-400/80">{parseError}</span>}
          </div>

          {result && <PreviewResult result={result} />}
        </div>
      )}
    </div>
  )
}

function PreviewResult({ result }: { result: TraceResult }) {
  return (
    <div className="flex flex-col gap-2 rounded border border-white/10 bg-[#101010] p-2">
      <div className={`text-xs font-medium ${result.matched ? 'text-emerald-400' : 'text-rose-400'}`}>
        Routed to: {result.matched ? 'TRUE' : 'FALSE'} branch
      </div>

      {result.error && (
        <div className="text-[11px] text-rose-400/80">
          Error: {result.error.message}
        </div>
      )}

      {result.matchedConditions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-emerald-400/70">Matched</div>
          <ul className="ml-1 list-disc pl-4 text-[11px] text-white/70 font-mono">
            {result.matchedConditions.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      )}

      {result.failedConditions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-rose-400/70">Failed</div>
          <ul className="ml-1 list-disc pl-4 text-[11px] text-white/70 font-mono">
            {result.failedConditions.map((c) => (
              <li key={c.condition}>
                {c.condition}
                <div className="ml-2 text-white/40">Actual: {formatActual(c.actual)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function formatActual(value: unknown): string {
  if (value === null || value === undefined) return '(none)'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
