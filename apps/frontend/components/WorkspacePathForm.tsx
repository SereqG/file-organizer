'use client'

import { useActionState, useEffect } from 'react'
import { submitWorkspacePath, WorkspacePathState } from '@/app/actions/workspace-path'
import { FolderExplorer } from './FolderExplorer'

import type { FileTreeNode } from '@/lib/types/explore'

const initialState: WorkspacePathState = {}

interface WorkspacePathFormProps {
  onNextStep: (path: string, tree: FileTreeNode, sessionId: string) => void
  onWorkspaceValidated?: () => void
  onBack?: () => void
}

export function WorkspacePathForm({ onNextStep, onWorkspaceValidated, onBack }: WorkspacePathFormProps) {
  const [state, formAction, pending] = useActionState(submitWorkspacePath, initialState)
  const isValidated = !!state.sessionId

  useEffect(() => {
    if (state.sessionId) onWorkspaceValidated?.()
  }, [state.sessionId, onWorkspaceValidated])

  return (
    <div className="flex w-full flex-col">
      {/* Form + hint — collapses when workspace is validated */}
      <div
        className="overflow-hidden transition-all duration-500 ease-out"
        style={{
          maxHeight: isValidated ? 0 : 200,
          opacity: isValidated ? 0 : 1,
          pointerEvents: isValidated ? 'none' : undefined,
        }}
      >
        <div className="flex flex-col gap-4">
          <form action={formAction} className="flex gap-3">
            <input
              type="text"
              name="path"
              placeholder="/home/user/documents"
              required
              disabled={pending}
              className="
                flex-1 rounded-xl border border-white/10 bg-white/[0.04]
                px-5 py-4 font-mono text-sm text-white placeholder:text-white/25
                outline-none transition-all duration-200
                focus:border-orange-500/50 focus:bg-white/[0.06]
                focus:shadow-[0_0_0_3px_rgba(249,115,22,0.12)]
                disabled:cursor-not-allowed disabled:opacity-50
              "
            />
            <button
              type="submit"
              disabled={pending}
              className="
                shrink-0 cursor-pointer rounded-xl bg-orange-500 px-8 py-4
                text-sm font-semibold tracking-wide text-black
                transition-all duration-200
                hover:bg-orange-400 hover:shadow-[0_0_28px_rgba(249,115,22,0.45)]
                active:scale-[0.99]
                disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none
              "
            >
              {pending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Validating…
                </span>
              ) : (
                'Set Workspace'
              )}
            </button>
          </form>

          <p className="text-xs leading-relaxed text-white/30">
            Paste the <span className="font-mono text-white/45">absolute path</span> to the folder you want to organise —
            e.g. <span className="font-mono text-white/45">/home/alice/documents</span> on Linux/macOS or{' '}
            <span className="font-mono text-white/45">C:\Users\Alice\Documents</span> on Windows.
            The folder must exist and be readable by this process.
          </p>
        </div>
      </div>

      {state.error && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-5 py-4">
          <span className="mt-0.5 shrink-0 text-red-400">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <p className="text-sm leading-relaxed text-red-400">{state.error.message}</p>
        </div>
      )}

      {state.sessionId && (
        <div className="animate-fade-slide-in">
          <FolderExplorer sessionId={state.sessionId} onNextStep={onNextStep} onBack={onBack} />
        </div>
      )}
    </div>
  )
}
