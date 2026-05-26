'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExploreJobResponse, FileTreeNode } from '@/lib/types/explore'
import { DepthConfirmModal } from './DepthConfirmModal'
import { FileTree } from './FileTree'

interface Props {
  sessionId: string
}

type ExploreState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'awaiting_confirmation'; detectedDepth: number; partialTree: FileTreeNode; directoryName: string }
  | { phase: 'complete'; tree: FileTreeNode }
  | { phase: 'error'; message: string }

export function FolderExplorer({ sessionId }: Props) {
  const [state, setState] = useState<ExploreState>({ phase: 'idle' })
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeJobIdRef = useRef<string | null>(null)

  const cancelPoll = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const pollJob = useCallback(async (jobId: string) => {
    let response: Response
    try {
      response = await fetch(`/api/explore/${jobId}`)
    } catch {
      cancelPoll()
      setState({ phase: 'error', message: 'Lost connection while scanning.' })
      return
    }

    if (!response.ok) {
      cancelPoll()
      setState({ phase: 'error', message: 'Failed to retrieve scan results.' })
      return
    }

    const job: ExploreJobResponse = await response.json()

    if (activeJobIdRef.current !== jobId) return

    if (job.status === 'COMPLETE' && job.tree) {
      setState({ phase: 'complete', tree: job.tree })
    } else if (job.status === 'AWAITING_CONFIRMATION' && job.tree) {
      setState({
        phase: 'awaiting_confirmation',
        detectedDepth: job.detected_depth ?? 4,
        partialTree: job.tree,
        directoryName: job.tree.name,
      })
    } else if (job.status === 'FAILED') {
      setState({ phase: 'error', message: job.error ?? 'Scan failed.' })
    } else {
      timeoutRef.current = setTimeout(() => pollJob(jobId), 1500)
    }
  }, [cancelPoll])

  const startExplore = useCallback(async (extendedDepth: boolean) => {
    setState({ phase: 'loading' })
    cancelPoll()

    let response: Response
    try {
      response = await fetch('/api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, extended_depth: extendedDepth }),
      })
    } catch {
      setState({ phase: 'error', message: 'Could not start directory scan.' })
      return
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setState({ phase: 'error', message: data.message ?? 'Failed to start scan.' })
      return
    }

    const { job_id: jobId } = await response.json()

    activeJobIdRef.current = jobId
    timeoutRef.current = setTimeout(() => pollJob(jobId), 1500)
  }, [sessionId, cancelPoll, pollJob])

  useEffect(() => {
    startExplore(false)
    return cancelPoll
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (state.phase === 'idle' || state.phase === 'loading') {
    return (
      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-white/30">
        <span className="size-4 rounded-full border-2 border-white/10 border-t-orange-400/60 animate-spin" />
        Scanning directory…
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
        <span className="mt-0.5 shrink-0 text-red-400">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        <p className="text-sm text-red-400 leading-relaxed">{state.message}</p>
      </div>
    )
  }

  if (state.phase === 'awaiting_confirmation') {
    return (
      <>
        <div className="mt-6">
          <FileTree root={state.partialTree} />
        </div>
        <DepthConfirmModal
          detectedDepth={state.detectedDepth}
          directoryName={state.directoryName}
          onConfirm={() => startExplore(true)}
          onCancel={() => setState({ phase: 'complete', tree: state.partialTree })}
        />
      </>
    )
  }

  return (
    <div className="mt-6">
      <p className="mb-2 text-xs text-white/25 font-mono">{state.tree.path}</p>
      <FileTree root={state.tree} />
      <button
        className="
          mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-medium
          bg-orange-500/10 border border-orange-500/20 text-orange-400
          hover:bg-orange-500/20 hover:border-orange-500/30
          transition-colors duration-150
        "
      >
        Next step
      </button>
    </div>
  )
}
