'use client'

import { useMemo, useState } from 'react'
import {
  AI_FIELD_PREFIX,
  CONDITION_FIELDS,
  isAiField,
} from '@/lib/workflow/registry/conditionFields'

interface FieldSelectProps {
  value: string
  onChange: (field: string) => void
}

const AI_SENTINEL = '__ai__'

export function FieldSelect({ value, onChange }: FieldSelectProps) {
  const startsAsAi = isAiField(value) || value === AI_FIELD_PREFIX
  const [isAiMode, setIsAiMode] = useState(startsAsAi)
  const [aiKey, setAiKey] = useState(startsAsAi ? value.slice(AI_FIELD_PREFIX.length) : '')

  const selectValue = useMemo(() => (isAiMode ? AI_SENTINEL : value), [isAiMode, value])

  const handleSelect = (next: string) => {
    if (next === AI_SENTINEL) {
      setIsAiMode(true)
      onChange(`${AI_FIELD_PREFIX}${aiKey}`)
      return
    }
    setIsAiMode(false)
    onChange(next)
  }

  const handleAiKeyChange = (key: string) => {
    setAiKey(key)
    onChange(`${AI_FIELD_PREFIX}${key}`)
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={selectValue}
        onChange={(e) => handleSelect(e.target.value)}
        className="rounded-md border border-white/10 bg-[#181818] px-2 py-1 text-xs text-white/80 focus:border-orange-500/60 focus:outline-none"
      >
        {CONDITION_FIELDS.map((f) => (
          <option key={f.field} value={f.field}>{f.label}</option>
        ))}
        <option value={AI_SENTINEL}>AI metadata…</option>
      </select>

      {isAiMode && (
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-white/40 font-mono">ai.</span>
          <input
            type="text"
            value={aiKey}
            onChange={(e) => handleAiKeyChange(e.target.value)}
            placeholder="category"
            className="w-24 rounded-md border border-white/10 bg-[#181818] px-2 py-1 text-xs text-white/80 focus:border-orange-500/60 focus:outline-none"
          />
        </div>
      )}
    </div>
  )
}
