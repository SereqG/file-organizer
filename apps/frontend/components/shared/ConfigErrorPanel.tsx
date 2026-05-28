'use client'

interface ConfigErrorPanelProps {
  error: Error
  onClose: () => void
}

export function ConfigErrorPanel({ error, onClose }: ConfigErrorPanelProps) {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-rose-400">Something went wrong</span>
        <span className="text-[11px] text-white/50 font-mono break-all">{error.message}</span>
      </div>
      <button
        onClick={onClose}
        className="self-start rounded-md border border-white/10 px-3 py-1 text-xs text-white/70 transition-colors hover:border-white/30 hover:text-white/90"
      >
        Close
      </button>
    </div>
  )
}
