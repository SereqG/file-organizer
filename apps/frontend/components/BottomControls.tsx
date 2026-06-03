'use client'

import { useEffect, useRef, useState } from 'react'
import { LuRefreshCw } from 'react-icons/lu'
import type { ConfigRemap, ExecutionFailedNode, WorkflowDefinition } from '@/lib/types/workflow'
import { ControlButton } from './ControlButton'
import { ViewportControls } from './ViewportControls'
import { RuntimeControls } from './RuntimeControls'

const COOLDOWN_SECONDS = 10

interface BottomControlsProps {
  definition: WorkflowDefinition | null
  rootPath: string
  onRunStart: () => void
  onRunComplete: (failedNodes: ExecutionFailedNode[]) => void
  onConfigRemap: (remaps: ConfigRemap[]) => void
  onReexplore: () => void
  isExploring: boolean
}

export function BottomControls({ definition, rootPath, onRunStart, onRunComplete, onConfigRemap, onReexplore, isExploring }: BottomControlsProps) {
  const [cooldownRemaining, setCooldownRemaining] = useState(0)

  useEffect(() => {
    if (cooldownRemaining <= 0) return
    const id = setTimeout(() => setCooldownRemaining(prev => Math.max(0, prev - 1)), 1000)
    return () => clearTimeout(id)
  }, [cooldownRemaining])

  function handleReexplore() {
    setCooldownRemaining(COOLDOWN_SECONDS)
    onReexplore()
  }

  const isOnCooldown = cooldownRemaining > 0
  const reexploreDisabled = isOnCooldown || isExploring
  const reexploreLabel = isOnCooldown ? `Re-explore (${cooldownRemaining}s)` : 'Re-explore file system'

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
      <ViewportControls />
      <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#111] p-1">
        <ControlButton
          label={reexploreLabel}
          onClick={handleReexplore}
          disabled={reexploreDisabled}
          disabledReason={isExploring ? 'Exploration in progress' : `Wait ${cooldownRemaining}s before re-exploring`}
        >
          <LuRefreshCw size={14} className={isExploring ? 'animate-spin' : ''} />
        </ControlButton>
      </div>
      <RuntimeControls
        definition={definition}
        rootPath={rootPath}
        onRunStart={onRunStart}
        onRunComplete={onRunComplete}
        onConfigRemap={onConfigRemap}
        isExploring={isExploring}
      />
    </div>
  )
}
