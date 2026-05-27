export function HeaderRow() {
  return (
    <div className="mb-10 flex items-center gap-5">
      <div
        className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-orange-500/20"
        style={{ background: 'rgba(249,115,22,0.08)', boxShadow: '0 0 28px rgba(249,115,22,0.12)' }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" className="text-orange-400">
          <path
            d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Set Workspace</h1>
        <p className="mt-1.5 text-sm text-white/40 leading-relaxed">
          Enter the absolute path to the directory you want to organize.
        </p>
      </div>
    </div>
  )
}
