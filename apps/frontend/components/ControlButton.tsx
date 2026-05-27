'use client'

interface ControlButtonProps {
  label: string
  onClick: () => void
  children: React.ReactNode
}

export function ControlButton({ label, onClick, children }: ControlButtonProps) {
  return (
    <div className="group relative flex">
      <button
        onClick={onClick}
        className="flex h-8 w-8 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        aria-label={label}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#1a1a1a] px-2 py-1 text-xs text-white/80 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {label}
      </span>
    </div>
  )
}
