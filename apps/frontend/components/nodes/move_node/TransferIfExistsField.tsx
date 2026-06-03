'use client'

import type { TransferIfExists } from '@/lib/types/workflow'

// Shared by the Move and Copy config modals. Includes the transfer-only `skip` option.
const IF_EXISTS_LABELS: Record<TransferIfExists, string> = {
  fail: 'Stop the run',
  rename_incrementally: 'Keep both (rename)',
  overwrite: 'Overwrite (destructive)',
  skip: 'Skip the item',
}

interface TransferIfExistsFieldProps {
  value: TransferIfExists
  onChange: (value: TransferIfExists) => void
}

export function TransferIfExistsField({ value, onChange }: TransferIfExistsFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-white/60" htmlFor="transfer-if-exists">
        If the destination already exists
      </label>
      <select
        id="transfer-if-exists"
        value={value}
        onChange={(e) => onChange(e.target.value as TransferIfExists)}
        className="rounded-md border border-white/10 bg-[#181818] px-3 py-1.5 text-xs text-white/90 focus:border-sky-500/60 focus:outline-none"
      >
        {(Object.keys(IF_EXISTS_LABELS) as TransferIfExists[]).map((option) => (
          <option key={option} value={option}>{IF_EXISTS_LABELS[option]}</option>
        ))}
      </select>
    </div>
  )
}
