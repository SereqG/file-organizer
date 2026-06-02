'use client'

import type { RenameIfExists } from '@/lib/types/workflow'

const RENAME_CONFLICT_LABELS: Record<RenameIfExists, string> = {
  fail: 'Fail',
  rename_incrementally: 'Rename incrementally',
}

interface RenameConflictFieldProps {
  value: RenameIfExists
  onChange: (value: RenameIfExists) => void
}

export function RenameConflictField({ value, onChange }: RenameConflictFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-white/60" htmlFor="rename-file-if-exists">
        If a file with the new name exists
      </label>
      <select
        id="rename-file-if-exists"
        value={value}
        onChange={(e) => onChange(e.target.value as RenameIfExists)}
        className="rounded-md border border-white/10 bg-[#181818] px-3 py-1.5 text-xs text-white/90 focus:border-sky-500/60 focus:outline-none"
      >
        {(Object.keys(RENAME_CONFLICT_LABELS) as RenameIfExists[]).map((s) => (
          <option key={s} value={s}>{RENAME_CONFLICT_LABELS[s]}</option>
        ))}
      </select>
    </div>
  )
}
