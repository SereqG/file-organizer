import { WorkspacePathForm } from '@/components/WorkspacePathForm'

export default function Home() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black overflow-hidden px-4">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(249,115,22,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Card */}
      <div
        className="
          relative z-10 w-full max-w-md rounded-2xl p-8
          border border-white/[0.07]
          shadow-[0_0_80px_rgba(249,115,22,0.07),0_32px_64px_rgba(0,0,0,0.6)]
        "
        style={{ background: 'rgba(8, 8, 8, 0.85)', backdropFilter: 'blur(24px)' }}
      >
        {/* Icon */}
        <div className="mb-6 flex items-center justify-center">
          <div
            className="flex size-14 items-center justify-center rounded-2xl border border-orange-500/20"
            style={{ background: 'rgba(249,115,22,0.08)', boxShadow: '0 0 24px rgba(249,115,22,0.12)' }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-orange-400">
              <path
                d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Set Workspace</h1>
          <p className="mt-2 text-sm text-white/35 leading-relaxed">
            Enter the absolute path to the directory you want to organize.
          </p>
        </div>

        <WorkspacePathForm />
      </div>
    </div>
  )
}
