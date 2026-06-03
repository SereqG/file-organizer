'use client'

interface KeepOriginalFieldProps {
  value: boolean
  onChange: (value: boolean) => void
}

export function KeepOriginalField({ value, onChange }: KeepOriginalFieldProps) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-sky-500"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-xs text-white/80">Keep the originals</span>
        <span className="text-[11px] text-white/40">When off, the source items are removed after the copies succeed.</span>
      </span>
    </label>
  )
}
