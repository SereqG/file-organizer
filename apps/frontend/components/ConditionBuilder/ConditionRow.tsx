'use client'

import type { Condition, ConditionOperator } from '@/lib/types/workflow'
import { defaultValueForKind, getFieldDescriptor } from '@/lib/workflow/registry/conditionFields'
import { FieldSelect } from './FieldSelect'
import { OperatorSelect } from './OperatorSelect'
import { ValueInput } from './ValueInput'
import type { ValidationError } from '@/lib/workflow/validation/validateIfConfig'

interface ConditionRowProps {
  condition: Condition
  path: string
  errors: ValidationError[]
  onChange: (next: Condition) => void
  onRemove: () => void
}

const STRING_OPS: ConditionOperator[] = ['equals', 'contains', 'starts_with', 'ends_with']

function isStringOperator(op: ConditionOperator): boolean {
  return STRING_OPS.includes(op)
}

export function ConditionRow({ condition, path, errors, onChange, onRemove }: ConditionRowProps) {
  const rowErrors = errors.filter((e) => e.path.startsWith(path))

  const handleFieldChange = (nextField: string) => {
    const descriptor = getFieldDescriptor(nextField)
    const allowed = descriptor?.allowedOperators ?? []
    const nextOperator: ConditionOperator = allowed.includes(condition.operator)
      ? condition.operator
      : (allowed[0] ?? 'equals')
    const nextValue = defaultValueForKind(descriptor?.valueKind ?? 'string', nextOperator)
    onChange({ ...condition, field: nextField, operator: nextOperator, value: nextValue })
  }

  const handleOperatorChange = (nextOperator: ConditionOperator) => {
    const descriptor = getFieldDescriptor(condition.field)
    const nextValue = defaultValueForKind(descriptor?.valueKind ?? 'string', nextOperator)
    onChange({ ...condition, operator: nextOperator, value: nextValue })
  }

  const handleValueChange = (nextValue: unknown) => {
    onChange({ ...condition, value: nextValue })
  }

  const toggleNegate = () => onChange({ ...condition, negate: !condition.negate })

  const toggleCaseSensitive = () => {
    const current = condition.options?.caseSensitive ?? true
    onChange({ ...condition, options: { ...condition.options, caseSensitive: !current } })
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border border-white/10 bg-[#141414] p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={toggleNegate}
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
            condition.negate
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/40'
              : 'border border-white/10 text-white/40 hover:text-white/70'
          }`}
          title="Negate this condition"
        >
          NOT
        </button>

        <FieldSelect value={condition.field} onChange={handleFieldChange} />
        <OperatorSelect field={condition.field} value={condition.operator} onChange={handleOperatorChange} />
        <ValueInput field={condition.field} operator={condition.operator} value={condition.value} onChange={handleValueChange} />

        {isStringOperator(condition.operator) && (
          <label className="flex items-center gap-1 text-[10px] text-white/50">
            <input
              type="checkbox"
              checked={condition.options?.caseSensitive ?? true}
              onChange={toggleCaseSensitive}
              className="h-3 w-3"
            />
            Case sensitive
          </label>
        )}

        <button
          onClick={onRemove}
          className="ml-auto text-white/40 hover:text-rose-400 text-xs"
          aria-label="Remove condition"
        >
          ×
        </button>
      </div>

      {rowErrors.length > 0 && (
        <ul className="ml-1 list-disc pl-4 text-[10px] text-rose-400/80">
          {rowErrors.map((err, i) => <li key={i}>{err.message}</li>)}
        </ul>
      )}
    </div>
  )
}
