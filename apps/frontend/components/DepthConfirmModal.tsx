interface Props {
  detectedDepth: number
  directoryName: string
  onConfirm: () => void
  onCancel: () => void
}

export function DepthConfirmModal({ detectedDepth, directoryName, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      <div
        className="relative z-10 w-full max-w-sm rounded-2xl p-6 border border-white/[0.08]"
        style={{ background: 'rgba(12, 12, 12, 0.95)', backdropFilter: 'blur(24px)' }}
      >
        <div className="mb-4 flex items-center justify-center">
          <div
            className="flex size-11 items-center justify-center rounded-xl border border-orange-500/20"
            style={{ background: 'rgba(249,115,22,0.08)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-orange-400">
              <path
                d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <h2 className="text-center text-base font-semibold text-white mb-2">
          Deep nesting detected
        </h2>
        <p className="text-center text-sm text-white/40 leading-relaxed mb-6">
          Directories nested beyond level {detectedDepth - 1} were found in{' '}
          <span className="font-mono text-white/60">{directoryName}</span>.
          Continuing may increase processing time.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white/50 border border-white/10 hover:bg-white/[0.04] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-orange-500 text-black hover:bg-orange-400 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
