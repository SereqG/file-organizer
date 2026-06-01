'use client'

interface NewNameFieldProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

export function NewNameField({ value, onChange, error }: NewNameFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-white/60" htmlFor="new-folder-name">
        New name
      </label>
      <input
        id="new-folder-name"
        type="text"
        value={value}
        maxLength={30}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Invoices_2026"
        className="rounded-md border border-white/10 bg-[#181818] px-3 py-1.5 text-xs text-white/90 placeholder:text-white/25 focus:border-sky-500/60 focus:outline-none"
      />
      {error && <span className="text-[11px] text-rose-400/80">{error}</span>}
    </div>
  )
}
