'use client'

import type { ConditionOperator } from '@/lib/types/workflow'
import { ITEM_TYPE_VALUES, getFieldDescriptor, type FieldValueKind } from '@/lib/workflow/registry/conditionFields'
import { formatBytes } from '@/lib/utils/format'

interface ValueInputProps {
  field: string
  operator: ConditionOperator
  value: unknown
  onChange: (value: unknown) => void
}

const DURATION_UNITS = ['minutes', 'hours', 'days', 'weeks'] as const
type DurationUnit = typeof DURATION_UNITS[number]
interface DurationValue { amount: number; unit: DurationUnit }

const SIZE_UNITS: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }

function parseSizeInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/)
  if (!match) return null
  const amount = parseFloat(match[1])
  const unit = (match[2] ?? 'B').toUpperCase()
  const multiplier = SIZE_UNITS[unit]
  if (multiplier === undefined) return null
  return Math.round(amount * multiplier)
}

const inputClass = 'rounded-md border border-white/10 bg-[#181818] px-2 py-1 text-xs text-white/80 focus:border-orange-500/60 focus:outline-none'

export function ValueInput({ field, operator, value, onChange }: ValueInputProps) {
  const descriptor = getFieldDescriptor(field)
  const valueKind: FieldValueKind = descriptor?.valueKind ?? 'string'

  if (operator === 'within_last') {
    const dur = (value as DurationValue) ?? { amount: 7, unit: 'days' as DurationUnit }
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          value={dur.amount}
          onChange={(e) => onChange({ ...dur, amount: Number(e.target.value) })}
          className={`${inputClass} w-16`}
        />
        <select
          value={dur.unit}
          onChange={(e) => onChange({ ...dur, unit: e.target.value as DurationUnit })}
          className={inputClass}
        >
          {DURATION_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
    )
  }

  if (operator === 'between') {
    const arr = Array.isArray(value) ? (value as unknown[]) : [undefined, undefined]
    return (
      <div className="flex items-center gap-1.5">
        <SingleValueInput field={field} valueKind={valueKind} value={arr[0]} onChange={(v) => onChange([v, arr[1]])} />
        <span className="text-[10px] text-white/40">and</span>
        <SingleValueInput field={field} valueKind={valueKind} value={arr[1]} onChange={(v) => onChange([arr[0], v])} />
      </div>
    )
  }

  return <SingleValueInput field={field} valueKind={valueKind} value={value} onChange={onChange} />
}

interface SingleValueInputProps {
  field: string
  valueKind: FieldValueKind
  value: unknown
  onChange: (value: unknown) => void
}

function SingleValueInput({ field, valueKind, value, onChange }: SingleValueInputProps) {
  if (valueKind === 'item-type') {
    return (
      <select
        value={(value as string) ?? 'file'}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        {ITEM_TYPE_VALUES.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    )
  }

  if (valueKind === 'boolean') {
    return (
      <select
        value={String(value ?? true)}
        onChange={(e) => onChange(e.target.value === 'true')}
        className={inputClass}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    )
  }

  if (valueKind === 'date') {
    return (
      <input
        type="datetime-local"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    )
  }

  if (valueKind === 'number') {
    if (field === 'size') {
      return <SizeInput value={value} onChange={onChange} />
    }
    return (
      <input
        type="number"
        value={value === undefined || value === null ? '' : Number(value)}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className={`${inputClass} w-28`}
      />
    )
  }

  return (
    <input
      type="text"
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={valueKind === 'ai' ? 'value' : ''}
      className={`${inputClass} w-40`}
    />
  )
}

function SizeInput({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const display = typeof value === 'number' ? formatBytes(value) : ''
  return (
    <input
      type="text"
      defaultValue={display}
      onBlur={(e) => {
        const parsed = parseSizeInput(e.target.value)
        if (parsed !== null) onChange(parsed)
      }}
      placeholder="e.g. 5MB"
      title="Accepts B, KB, MB, GB, TB. Stored in bytes."
      className={`${inputClass} w-28`}
    />
  )
}
