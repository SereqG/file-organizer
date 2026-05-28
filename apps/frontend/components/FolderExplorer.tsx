'use client'

import type { FileTreeNode } from '@/lib/types/explore'
import { useExploreJob } from '@/hooks/useExploreJob'
import { DepthConfirmModal } from './DepthConfirmModal'
import { FileTree } from './FileTree'

const SLOW_SCAN_THRESHOLD_S = 8

interface Props {
  sessionId: string
  onNextStep: (path: string, tree: FileTreeNode) => void
}

export function FolderExplorer({ sessionId, onNextStep }: Props) {
  const { state, elapsedSeconds, startExplore, acceptPartialTree, cancelScan } = useExploreJob(sessionId)

  if (state.phase === 'idle' || state.phase === 'loading') {
    const isSlow = elapsedSeconds >= SLOW_SCAN_THRESHOLD_S

    return (
      <div className="mt-8 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2.5 text-sm text-white/30">
          <span className="size-4 rounded-full border-2 border-white/10 border-t-orange-400/60 animate-spin" />
          {isSlow ? `Still scanning… ${elapsedSeconds}s` : 'Scanning directory…'}
        </div>
        {isSlow && (
          <button
            onClick={cancelScan}
            className="text-xs text-white/30 hover:text-white/50 transition-colors duration-150 cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="mt-8 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-5 py-4">
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
        <div className="mt-8">
          <FileTree root={state.partialTree} />
        </div>
        <DepthConfirmModal
          detectedDepth={state.detectedDepth}
          directoryName={state.directoryName}
          onConfirm={() => startExplore(true)}
          onCancel={() => acceptPartialTree(state.partialTree)}
        />
      </>
    )
  }

  return (
    <div className="mt-8">
      <p className="mb-3 text-xs text-white/30 font-mono">{state.tree.path}</p>
      <FileTree root={state.tree} />
      <button
        onClick={() => onNextStep(state.tree.path, state.tree)}
        className="
          mt-5 w-full rounded-xl px-5 py-3.5 text-sm font-medium
          bg-orange-500/10 border border-orange-500/20 text-orange-400
          hover:bg-orange-500/20 hover:border-orange-500/30
          transition-colors duration-150 cursor-pointer
        "
      >
        Next step
      </button>
    </div>
  )
}
