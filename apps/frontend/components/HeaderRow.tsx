import { LuFolder } from 'react-icons/lu'

export function HeaderRow() {
  return (
    <div className="mb-10 flex items-center gap-5">
      <div
        className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-orange-500/20"
        style={{ background: 'rgba(249,115,22,0.08)', boxShadow: '0 0 28px rgba(249,115,22,0.12)' }}
      >
        <LuFolder size={30} className="text-orange-400" />
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
