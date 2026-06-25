'use client'

import { useCallback, useEffect, useState } from 'react'
import { LuCircleAlert } from 'react-icons/lu'
import type { FileTreeNode } from '@/lib/types/explore'
import { FolderExplorer } from './FolderExplorer'

interface SandboxOnboardingProps {
  onNextStep: (path: string, tree: FileTreeNode) => void
  onWorkspaceValidated?: () => void
  onBack?: () => void
}

type State =
  | { phase: 'creating' }
  | { phase: 'ready' }
  | { phase: 'error' }

/**
 * Replaces the old "type an absolute host path" onboarding. On mount it provisions (or reattaches
 * to, via the session cookie) an isolated sandbox, then hands the session to the folder explorer so
 * the visitor picks their workflow root from inside that sandbox — never the real host.
 */
export function SandboxOnboarding({ onNextStep, onWorkspaceValidated, onBack }: SandboxOnboardingProps) {
  const [state, setState] = useState<State>({ phase: 'creating' })

  // First statement is an await, so this never calls setState synchronously inside the mount effect.
  const provision = useCallback(async () => {
    try {
      const res = await fetch('/api/sandbox/session', { method: 'POST' })
      if (!res.ok) throw new Error('failed')
      // The session id is intentionally not returned in the body; it lives only in the httpOnly
      // cookie and is attached to backend calls server-side by the proxies.
      setState({ phase: 'ready' })
      onWorkspaceValidated?.()
    } catch {
      setState({ phase: 'error' })
    }
  }, [onWorkspaceValidated])

  useEffect(() => {
    void provision()
  }, [provision])

  const retry = useCallback(() => {
    setState({ phase: 'creating' })
    void provision()
  }, [provision])

  if (state.phase === 'creating') {
    return (
      <div className="mt-8 flex items-center justify-center gap-2.5 text-sm text-white/30">
        <span className="size-4 rounded-full border-2 border-white/10 border-t-orange-400/60 animate-spin" />
        Preparing your sandbox…
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="mt-8 flex flex-col items-center gap-4">
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-5 py-4">
          <LuCircleAlert size={16} className="mt-0.5 shrink-0 text-red-400" />
          <p className="text-sm leading-relaxed text-red-400">
            Could not prepare your sandbox. Make sure the backend is running, then retry.
          </p>
        </div>
        <button
          onClick={retry}
          className="
            cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3
            text-sm font-medium text-white/50 transition-colors duration-150
            hover:border-white/20 hover:bg-white/[0.07] hover:text-white/70
          "
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="animate-fade-slide-in">
      <FolderExplorer onNextStep={onNextStep} onBack={onBack} />
    </div>
  )
}
