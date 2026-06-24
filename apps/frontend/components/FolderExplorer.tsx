'use client'

import { useState } from 'react'
import { LuCircleAlert } from 'react-icons/lu'
import type { FileTreeNode } from '@/lib/types/explore'
import { useExploreJob } from '@/hooks/useExploreJob'
import { DepthConfirmModal } from './DepthConfirmModal'
import { FileTree } from './FileTree'
import { WorkspaceSelectorTree } from './WorkspaceSelectorTree'

const SLOW_SCAN_THRESHOLD_S = 8

interface Props {
  sessionId: string
  onNextStep: (path: string, tree: FileTreeNode, sessionId: string) => void
  onBack?: () => void
}

export function FolderExplorer({ sessionId, onNextStep, onBack }: Props) {
  const { state, elapsedSeconds, startExplore, acceptPartialTree, cancelScan } = useExploreJob(sessionId)
  const [selectedNode, setSelectedNode] = useState<FileTreeNode | null>(null)

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
        <LuCircleAlert size={16} className="mt-0.5 shrink-0 text-red-400" />
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

  const effectiveSelected = selectedNode ?? state.tree

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/[0.08] px-5 py-4">
        <LuCircleAlert size={16} className="mt-0.5 shrink-0 text-yellow-400" />
        <p className="text-sm font-medium text-yellow-400 leading-relaxed">
          This is a sandbox for testing and demo purposes only. You are not working on a real filesystem.
        </p>
      </div>
      <p className="mb-1 text-xs text-white/30">Select a workspace folder</p>
      <p className="mb-3 text-xs text-white/20 font-mono truncate">{effectiveSelected.path}</p>
      <WorkspaceSelectorTree
        root={state.tree}
        selectedId={effectiveSelected.id}
        onSelect={setSelectedNode}
      />
      <div className="mt-5 flex gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="
              rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3
              text-sm font-medium text-white/40
              hover:border-white/20 hover:bg-white/[0.07] hover:text-white/60
              transition-colors duration-150 cursor-pointer
            "
          >
            Back
          </button>
        )}
        <button
          onClick={() => onNextStep(effectiveSelected.path, effectiveSelected, sessionId)}
          className="
            flex-1 rounded-xl px-5 py-3.5 text-sm font-medium
            bg-orange-500/10 border border-orange-500/20 text-orange-400
            hover:bg-orange-500/20 hover:border-orange-500/30
            transition-colors duration-150 cursor-pointer
          "
        >
          Next step
        </button>
      </div>
    </div>
  )
}
