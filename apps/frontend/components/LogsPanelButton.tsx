'use client'

import { LuScrollText } from 'react-icons/lu'
import { useWorkflowRun } from '@/lib/contexts/WorkflowRunContext'

interface LogsPanelButtonProps {
  panelOpen: boolean
  onToggle: () => void
}

export function LogsPanelButton({ panelOpen, onToggle }: LogsPanelButtonProps) {
  const { isRunning, hasRun } = useWorkflowRun()

  if (!hasRun) return null

  const pulsing = isRunning && !panelOpen

  return (
    <button
      onClick={onToggle}
      className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1.5
        rounded-l-lg border border-r-0 border-white/10 bg-[#111] px-2 py-3
        text-xs font-medium text-white/60 hover:text-white/90 transition-colors
        ${pulsing ? 'animate-pulse' : ''}`}
      aria-label="Toggle execution logs"
    >
      <LuScrollText size={14} />
    </button>
  )
}
