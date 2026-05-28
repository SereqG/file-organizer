'use client'

import {
  MAX_GROUP_DEPTH,
  isConditionGroup,
  type Condition,
  type ConditionGroup,
  type LogicalOperator,
} from '@/lib/types/workflow'
import { nextId } from '@/lib/workflow/utils/nextId'
import { ConditionRow } from './ConditionRow'
import type { ValidationError } from '@/lib/workflow/validation/validateIfConfig'

interface ConditionGroupEditorProps {
  group: ConditionGroup
  path: string
  depth: number
  errors: ValidationError[]
  onChange: (next: ConditionGroup) => void
  onRemove?: () => void
}

function emptyCondition(): Condition {
  return { id: nextId('cond'), field: 'extension', operator: 'equals', value: '' }
}

function emptyGroup(): ConditionGroup {
  return { id: nextId('group'), operator: 'AND', children: [] }
}

export function ConditionGroupEditor({ group, path, depth, errors, onChange, onRemove }: ConditionGroupEditorProps) {
  const directErrors = errors.filter((e) => e.path === path)
  const canNestDeeper = depth < MAX_GROUP_DEPTH - 1

  const updateChild = (index: number, next: Condition | ConditionGroup) => {
    const children = group.children.slice()
    children[index] = next
    onChange({ ...group, children })
  }

  const removeChild = (index: number) => {
    const children = group.children.slice()
    children.splice(index, 1)
    onChange({ ...group, children })
  }

  const addCondition = () => {
    onChange({ ...group, children: [...group.children, emptyCondition()] })
  }

  const addGroup = () => {
    onChange({ ...group, children: [...group.children, emptyGroup()] })
  }

  const setOperator = (op: LogicalOperator) => onChange({ ...group, operator: op })
  const toggleNegate = () => onChange({ ...group, negate: !group.negate })

  return (
    <div className="flex flex-col gap-2 rounded-md border border-white/15 bg-[#101010] p-2.5">
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleNegate}
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
            group.negate
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/40'
              : 'border border-white/10 text-white/40 hover:text-white/70'
          }`}
          title="Negate this group"
        >
          NOT
        </button>

        <div className="inline-flex overflow-hidden rounded border border-white/10">
          {(['AND', 'OR'] as LogicalOperator[]).map((op) => (
            <button
              key={op}
              onClick={() => setOperator(op)}
              className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                group.operator === op
                  ? 'bg-orange-500/20 text-orange-300'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {op}
            </button>
          ))}
        </div>

        {onRemove && (
          <button
            onClick={onRemove}
            className="ml-auto text-white/40 hover:text-rose-400 text-xs"
            aria-label="Remove group"
          >
            ×
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 pl-2 border-l border-white/10">
        {group.children.map((child, index) => {
          const childPath = `${path}.children[${index}]`
          if (isConditionGroup(child)) {
            return (
              <ConditionGroupEditor
                key={child.id}
                group={child}
                path={childPath}
                depth={depth + 1}
                errors={errors}
                onChange={(next) => updateChild(index, next)}
                onRemove={() => removeChild(index)}
              />
            )
          }
          return (
            <ConditionRow
              key={child.id}
              condition={child}
              path={childPath}
              errors={errors}
              onChange={(next) => updateChild(index, next)}
              onRemove={() => removeChild(index)}
            />
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={addCondition}
          className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-white/60 transition-colors hover:border-white/30 hover:text-white/90"
        >
          + condition
        </button>
        <button
          onClick={addGroup}
          disabled={!canNestDeeper}
          title={canNestDeeper ? '' : `Max nesting depth is ${MAX_GROUP_DEPTH}`}
          className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-white/60 transition-colors hover:border-white/30 hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + group
        </button>
      </div>

      {directErrors.length > 0 && (
        <ul className="list-disc pl-4 text-[10px] text-rose-400/80">
          {directErrors.map((err, i) => <li key={i}>{err.message}</li>)}
        </ul>
      )}
    </div>
  )
}
