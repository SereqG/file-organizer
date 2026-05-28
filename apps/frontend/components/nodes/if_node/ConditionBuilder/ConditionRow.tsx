'use client'

import { memo, useCallback, useRef } from 'react'
import type { Condition, ConditionOperator } from '@/lib/types/workflow'
import { defaultValueForKind, getFieldDescriptor } from '@/lib/workflow/registry/conditionFields'
import { FieldSelect } from './FieldSelect'
import { OperatorSelect } from './OperatorSelect'
import { ValueInput } from './ValueInput'
interface ConditionRowProps {
  condition: Condition
  path: string
  errors: Record<string, string>
  onChange: (next: Condition) => void
  onRemove: () => void
}

const STRING_OPS: ConditionOperator[] = ['equals', 'contains', 'starts_with', 'ends_with']

function isStringOperator(op: ConditionOperator): boolean {
  return STRING_OPS.includes(op)
}

function arePropsEqual(prev: ConditionRowProps, next: ConditionRowProps): boolean {
  if (prev.condition !== next.condition || prev.path !== next.path) return false
  const prevKeys = Object.keys(prev.errors).filter(p => p.startsWith(prev.path))
  const nextKeys = Object.keys(next.errors).filter(p => p.startsWith(next.path))
  return prevKeys.length === nextKeys.length && prevKeys.every(k => prev.errors[k] === next.errors[k])
}

export const ConditionRow = memo(function ConditionRow({ condition, path, errors, onChange, onRemove }: ConditionRowProps) {
  const conditionRef = useRef(condition)
  conditionRef.current = condition
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onRemoveRef = useRef(onRemove)
  onRemoveRef.current = onRemove

  const rowErrors = Object.entries(errors).filter(([p]) => p.startsWith(path)).map(([, message]) => ({ message }))

  const handleFieldChange = useCallback((nextField: string) => {
    const c = conditionRef.current
    const descriptor = getFieldDescriptor(nextField)
    const allowed = descriptor?.allowedOperators ?? []
    const nextOperator: ConditionOperator = allowed.includes(c.operator)
      ? c.operator
      : (allowed[0] ?? 'equals')
    const nextValue = defaultValueForKind(descriptor?.valueKind ?? 'string', nextOperator)
    onChangeRef.current({ ...c, field: nextField, operator: nextOperator, value: nextValue })
  }, [])

  const handleOperatorChange = useCallback((nextOperator: ConditionOperator) => {
    const c = conditionRef.current
    const descriptor = getFieldDescriptor(c.field)
    const nextValue = defaultValueForKind(descriptor?.valueKind ?? 'string', nextOperator)
    onChangeRef.current({ ...c, operator: nextOperator, value: nextValue })
  }, [])

  const handleValueChange = useCallback((nextValue: unknown) => {
    onChangeRef.current({ ...conditionRef.current, value: nextValue })
  }, [])

  const toggleNegate = useCallback(() => {
    const c = conditionRef.current
    onChangeRef.current({ ...c, negate: !c.negate })
  }, [])

  const toggleCaseSensitive = useCallback(() => {
    const c = conditionRef.current
    const current = c.options?.caseSensitive ?? true
    onChangeRef.current({ ...c, options: { ...c.options, caseSensitive: !current } })
  }, [])

  const handleRemove = useCallback(() => onRemoveRef.current(), [])

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
          onClick={handleRemove}
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
}, arePropsEqual)
