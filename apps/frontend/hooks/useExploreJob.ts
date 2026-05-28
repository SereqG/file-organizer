'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExploreJobResponse, FileTreeNode } from '@/lib/types/explore'

const INITIAL_POLL_MS = 1500
const BACKOFF_FACTOR = 1.5
const MAX_POLL_MS = 5000
const HARD_TIMEOUT_MS = 120_000
const SLOW_SCAN_THRESHOLD_S = 8

export type ExploreState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'awaiting_confirmation'; detectedDepth: number; partialTree: FileTreeNode; directoryName: string }
  | { phase: 'complete'; tree: FileTreeNode }
  | { phase: 'error'; message: string }

export function useExploreJob(sessionId: string) {
  const [state, setState] = useState<ExploreState>({ phase: 'idle' })
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeJobIdRef = useRef<string | null>(null)
  const attemptRef = useRef(0)
  const scanStartRef = useRef<number | null>(null)

  const cancelPoll = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (tickerRef.current !== null) {
      clearInterval(tickerRef.current)
      tickerRef.current = null
    }
  }, [])

  const startTicker = useCallback(() => {
    scanStartRef.current = Date.now()
    setElapsedSeconds(0)
    tickerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - (scanStartRef.current ?? Date.now())) / 1000))
    }, 1000)
  }, [])

  const pollJob = useCallback(async (jobId: string) => {
    if (scanStartRef.current !== null && Date.now() - scanStartRef.current >= HARD_TIMEOUT_MS) {
      cancelPoll()
      setState({ phase: 'error', message: 'Directory scan timed out after 2 minutes.' })
      return
    }

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
      cancelPoll()
      setState({ phase: 'complete', tree: job.tree })
    } else if (job.status === 'AWAITING_CONFIRMATION' && job.tree) {
      cancelPoll()
      setState({
        phase: 'awaiting_confirmation',
        detectedDepth: job.detected_depth ?? 4,
        partialTree: job.tree,
        directoryName: job.tree.name,
      })
    } else if (job.status === 'FAILED') {
      cancelPoll()
      setState({ phase: 'error', message: job.error ?? 'Scan failed.' })
    } else {
      const delay = Math.min(INITIAL_POLL_MS * Math.pow(BACKOFF_FACTOR, attemptRef.current), MAX_POLL_MS)
      attemptRef.current += 1
      timeoutRef.current = setTimeout(() => pollJob(jobId), delay)
    }
  }, [cancelPoll])

  const startExplore = useCallback(async (extendedDepth: boolean) => {
    setState({ phase: 'loading' })
    cancelPoll()
    attemptRef.current = 0
    startTicker()

    let response: Response
    try {
      response = await fetch('/api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, extended_depth: extendedDepth }),
      })
    } catch {
      cancelPoll()
      setState({ phase: 'error', message: 'Could not start directory scan.' })
      return
    }

    if (!response.ok) {
      cancelPoll()
      const data = await response.json().catch(() => ({}))
      setState({ phase: 'error', message: data.message ?? 'Failed to start scan.' })
      return
    }

    const { job_id: jobId } = await response.json()

    activeJobIdRef.current = jobId
    timeoutRef.current = setTimeout(() => pollJob(jobId), INITIAL_POLL_MS)
  }, [sessionId, cancelPoll, pollJob, startTicker])

  const acceptPartialTree = useCallback((tree: FileTreeNode) => {
    cancelPoll()
    setState({ phase: 'complete', tree })
  }, [cancelPoll])

  useEffect(() => {
    startExplore(false)
    return cancelPoll
  }, [startExplore, cancelPoll])

  return { state, elapsedSeconds, startExplore, acceptPartialTree, cancelScan: cancelPoll }
}
