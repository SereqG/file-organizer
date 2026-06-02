'use client'

interface NewNameFieldProps {
  value: string
  extension: string
  onChange: (value: string) => void
  error?: string
}

export function NewNameField({ value, extension, onChange, error }: NewNameFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-white/60" htmlFor="new-file-name">
        New name
      </label>
      <div className="flex items-stretch rounded-md border border-white/10 bg-[#181818] focus-within:border-sky-500/60">
        <input
          id="new-file-name"
          type="text"
          value={value}
          maxLength={30}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. invoice_2026"
          className="min-w-0 flex-1 rounded-l-md bg-transparent px-3 py-1.5 text-xs text-white/90 placeholder:text-white/25 focus:outline-none"
        />
        {extension && (
          <span
            title="The extension cannot be changed"
            className="flex select-none items-center border-l border-white/10 px-2.5 text-xs font-mono text-white/40"
          >
            {extension}
          </span>
        )}
      </div>
      {error && <span className="text-[11px] text-rose-400/80">{error}</span>}
    </div>
  )
}
