'use client'

interface ControlButtonProps {
  label: string
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  disabledReason?: string
}

export function ControlButton({ label, onClick, children, disabled, disabledReason }: ControlButtonProps) {
  const tooltipText = disabled && disabledReason ? disabledReason : label

  return (
    <div className="group relative flex">
      <button
        onClick={onClick}
        disabled={disabled}
        className="flex h-8 w-8 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white/60"
        aria-label={label}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#1a1a1a] px-2 py-1 text-xs text-white/80 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {tooltipText}
      </span>
    </div>
  )
}
