import { WorkspacePathForm } from '@/components/WorkspacePathForm'

export default function Home() {
  return (
    <div className="relative flex min-h-screen items-start justify-center bg-black overflow-hidden px-6 py-12">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 30%, rgba(249,115,22,0.07) 0%, transparent 65%)',
        }}
      />

      {/* Card */}
      <div
        className="
          relative z-10 w-full max-w-4xl rounded-2xl p-10
          border border-white/[0.07]
          shadow-[0_0_100px_rgba(249,115,22,0.07),0_40px_80px_rgba(0,0,0,0.6)]
        "
        style={{ background: 'rgba(8, 8, 8, 0.88)', backdropFilter: 'blur(28px)' }}
      >
        {/* Header row */}
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

        <WorkspacePathForm />
      </div>
    </div>
  )
}
