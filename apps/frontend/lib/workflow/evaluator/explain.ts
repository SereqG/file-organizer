import {
  isConditionGroup,
  type Condition,
  type ConditionGroup,
  type EvaluationFailure,
  type EvaluationResult,
  type MissingFieldStrategy,
  type WorkflowItem,
} from '@/lib/types/workflow'
import { OPERATOR_LABELS } from '@/lib/workflow/registry/conditionFields'
import { applyOperator } from './operators'
import { getFieldValue, type AccessorContext } from './fieldAccessors'
import { MissingFieldError } from './evaluate'

export interface ExplainOptions {
  missingFieldStrategy?: MissingFieldStrategy
  depth?: number
}

export interface TraceResult extends EvaluationResult {
  error?: { field: string; message: string }
}

export async function evaluateWithTrace(
  item: WorkflowItem,
  group: ConditionGroup,
  opts: ExplainOptions = {},
): Promise<TraceResult> {
  const ctx: AccessorContext = { depth: opts.depth ?? 0 }
  const strategy = opts.missingFieldStrategy ?? 'false'
  const matched: string[] = []
  const failed: EvaluationFailure[] = []

  try {
    const result = await walkGroup(item, group, ctx, strategy, matched, failed)
    return { matched: result, matchedConditions: matched, failedConditions: failed }
  } catch (err) {
    if (err instanceof MissingFieldError) {
      return {
        matched: false,
        matchedConditions: matched,
        failedConditions: failed,
        error: { field: err.field, message: err.message },
      }
    }
    throw err
  }
}

async function walkGroup(
  item: WorkflowItem,
  group: ConditionGroup,
  ctx: AccessorContext,
  strategy: MissingFieldStrategy,
  matched: string[],
  failed: EvaluationFailure[],
): Promise<boolean> {
  let result = group.operator === 'AND'

  for (const child of group.children) {
    const childResult = isConditionGroup(child)
      ? await walkGroup(item, child, ctx, strategy, matched, failed)
      : await walkCondition(item, child, ctx, strategy, matched, failed)

    if (group.operator === 'AND') {
      if (!childResult) { result = false; break }
    } else {
      if (childResult) { result = true; break }
      result = false
    }
  }

  return group.negate ? !result : result
}

async function walkCondition(
  item: WorkflowItem,
  condition: Condition,
  ctx: AccessorContext,
  strategy: MissingFieldStrategy,
  matched: string[],
  failed: EvaluationFailure[],
): Promise<boolean> {
  const label = describeCondition(condition)
  const lookup = getFieldValue(item, condition.field, ctx)

  if (!lookup.found) {
    if (strategy === 'error') throw new MissingFieldError(condition.field)
    if (strategy === 'skip') {
      matched.push(`${label} (skipped — missing field)`)
      return false
    }
    const final = condition.negate ? true : false
    if (final) matched.push(label)
    else failed.push({ condition: label, expected: condition.value, actual: '(missing)' })
    return final
  }

  const outcome = applyOperator(
    condition.operator,
    lookup.value,
    condition.value,
    { caseSensitive: condition.options?.caseSensitive ?? true },
  )
  const final = condition.negate ? !outcome.matched : outcome.matched
  if (final) matched.push(label)
  else failed.push({ condition: label, expected: outcome.expected, actual: outcome.actual })
  return final
}

function describeCondition(condition: Condition): string {
  const prefix = condition.negate ? 'NOT ' : ''
  const op = OPERATOR_LABELS[condition.operator]
  return `${prefix}${condition.field} ${op} ${formatValue(condition.value)}`.trim()
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return value.map(formatValue).join(' and ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
