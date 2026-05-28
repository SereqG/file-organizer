'use client'

import type { IfExists } from '@/lib/types/workflow'

const IF_EXISTS_LABELS: Record<IfExists, string> = {
  reuse_existing: 'Reuse existing (recommended)',
  rename_incrementally: 'Rename incrementally',
  overwrite: 'Overwrite (destructive)',
  fail: 'Fail',
}

interface IfExistsFieldProps {
  value: IfExists
  onChange: (value: IfExists) => void
}

export function IfExistsField({ value, onChange }: IfExistsFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-white/60" htmlFor="if-exists">
        If folder already exists
      </label>
      <select
        id="if-exists"
        value={value}
        onChange={(e) => onChange(e.target.value as IfExists)}
        className="rounded-md border border-white/10 bg-[#181818] px-3 py-1.5 text-xs text-white/90 focus:border-sky-500/60 focus:outline-none"
      >
        {(Object.keys(IF_EXISTS_LABELS) as IfExists[]).map((s) => (
          <option key={s} value={s}>{IF_EXISTS_LABELS[s]}</option>
        ))}
      </select>
    </div>
  )
}
