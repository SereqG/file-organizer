'use client'

interface AddTriggerButtonProps {
  onClick: () => void
}

export function AddTriggerButton({ onClick }: AddTriggerButtonProps) {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-3">
      <button
        onClick={onClick}
        className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/5 text-white/40 transition-all hover:border-orange-500/60 hover:bg-orange-500/10 hover:text-orange-400"
        aria-label="Add trigger"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <span className="text-xs text-white/30">Add trigger</span>
    </div>
  )
}
