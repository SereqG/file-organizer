'use client'

import type { ConditionOperator } from '@/lib/types/workflow'
import { OPERATOR_LABELS, getFieldDescriptor } from '@/lib/workflow/registry/conditionFields'

interface OperatorSelectProps {
  field: string
  value: ConditionOperator
  onChange: (operator: ConditionOperator) => void
}

export function OperatorSelect({ field, value, onChange }: OperatorSelectProps) {
  const descriptor = getFieldDescriptor(field)
  const operators = descriptor?.allowedOperators ?? []

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ConditionOperator)}
      className="rounded-md border border-white/10 bg-[#181818] px-2 py-1 text-xs text-white/80 focus:border-orange-500/60 focus:outline-none"
    >
      {operators.map((op) => (
        <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
      ))}
    </select>
  )
}
