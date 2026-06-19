'use client'

import { LuLibrary } from 'react-icons/lu'

interface WorkflowLibraryButtonProps {
  onToggle: () => void
}

export function WorkflowLibraryButton({ onToggle }: WorkflowLibraryButtonProps) {
  return (
    <button
      onClick={onToggle}
      className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1.5
        rounded-r-lg border border-l-0 border-white/10 bg-[#111] px-2 py-3
        text-xs font-medium text-white/60 hover:text-white/90 transition-colors"
      aria-label="Toggle workflow library"
    >
      <LuLibrary size={14} />
    </button>
  )
}
