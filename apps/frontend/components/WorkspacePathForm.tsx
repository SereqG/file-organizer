'use client'

import { useActionState } from 'react'
import { submitWorkspacePath, WorkspacePathState } from '@/app/actions/workspace-path'
import { FolderExplorer } from './FolderExplorer'
import { Card } from './Card'
import { HeaderRow } from './HeaderRow'

const initialState: WorkspacePathState = {}

import type { FileTreeNode } from '@/lib/types/explore'

interface WorkspacePathFormProps {
  onNextStep: (path: string, tree: FileTreeNode) => void
}

export function WorkspacePathForm({ onNextStep }: WorkspacePathFormProps) {
  const [state, formAction, pending] = useActionState(submitWorkspacePath, initialState)

  return (
    <Card>
      <HeaderRow />
      <form action={formAction} className="flex flex-col gap-5">
      <div className="flex gap-3">
        <input
          type="text"
          name="path"
          placeholder="/home/user/documents"
          required
          disabled={pending}
          className="
            flex-1 bg-white/[0.04] border border-white/10 rounded-xl
            px-5 py-4 text-white placeholder:text-white/25
            outline-none transition-all duration-200
            focus:border-orange-500/50 focus:bg-white/[0.06]
            focus:shadow-[0_0_0_3px_rgba(249,115,22,0.12)]
            disabled:opacity-50 disabled:cursor-not-allowed
            font-mono text-sm
          "
        />
        <button
          type="submit"
          disabled={pending}
          className="
            shrink-0 px-8 py-4 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200
            bg-orange-500 text-black
            hover:bg-orange-400 hover:shadow-[0_0_28px_rgba(249,115,22,0.45)]
            active:scale-[0.99]
            disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none
            cursor-pointer
          "
        >
          {pending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="size-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
              Validating…
            </span>
          ) : (
            'Set Workspace'
          )}
        </button>
      </div>

      {state.error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-5 py-4">
          <span className="mt-0.5 shrink-0 text-red-400">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <p className="text-sm text-red-400 leading-relaxed">{state.error.message}</p>
        </div>
      )}

      {state.sessionId && (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-orange-500/20 bg-orange-500/[0.06] px-5 py-4">
            <span className="mt-0.5 shrink-0 text-orange-400">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 8l2.5 2.5L11 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="text-sm text-orange-400 leading-relaxed">Workspace configured successfully.</p>
          </div>
          <FolderExplorer sessionId={state.sessionId} onNextStep={onNextStep} />
        </>
      )}
      </form>
    </Card>
  )
}
