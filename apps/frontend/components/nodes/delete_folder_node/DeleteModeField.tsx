'use client'

interface DeleteModeFieldProps {
  value: boolean
  onChange: (value: boolean) => void
}

export function DeleteModeField({ value, onChange }: DeleteModeFieldProps) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-rose-500"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-xs text-white/80">Delete all directories encountered during execution</span>
        <span className="text-[11px] text-white/40">Ignores the selection below and deletes every directory the workflow reaches.</span>
      </span>
    </label>
  )
}
