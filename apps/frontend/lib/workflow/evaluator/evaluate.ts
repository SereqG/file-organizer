import {
  isConditionGroup,
  type Condition,
  type ConditionGroup,
  type MissingFieldStrategy,
  type WorkflowItem,
} from '@/lib/types/workflow'
import { applyOperator } from './operators'
import { getFieldValue, type AccessorContext } from './fieldAccessors'

export interface EvaluateOptions {
  missingFieldStrategy?: MissingFieldStrategy
  depth?: number
}

export class MissingFieldError extends Error {
  field: string
  constructor(field: string) {
    super(`Missing field: ${field}`)
    this.field = field
  }
}

export async function evaluate(
  item: WorkflowItem,
  group: ConditionGroup,
  opts: EvaluateOptions = {},
): Promise<boolean> {
  const ctx: AccessorContext = { depth: opts.depth ?? 0 }
  const strategy = opts.missingFieldStrategy ?? 'false'
  return evaluateGroup(item, group, ctx, strategy)
}

async function evaluateGroup(
  item: WorkflowItem,
  group: ConditionGroup,
  ctx: AccessorContext,
  strategy: MissingFieldStrategy,
): Promise<boolean> {
  const initial = group.operator === 'AND'
  let result = initial

  for (const child of group.children) {
    const childResult = isConditionGroup(child)
      ? await evaluateGroup(item, child, ctx, strategy)
      : await evaluateCondition(item, child, ctx, strategy)

    if (group.operator === 'AND') {
      if (!childResult) { result = false; break }
    } else {
      if (childResult) { result = true; break }
      result = false
    }
  }

  return group.negate ? !result : result
}

async function evaluateCondition(
  item: WorkflowItem,
  condition: Condition,
  ctx: AccessorContext,
  strategy: MissingFieldStrategy,
): Promise<boolean> {
  const lookup = getFieldValue(item, condition.field, ctx)
  if (!lookup.found) {
    if (strategy === 'error') throw new MissingFieldError(condition.field)
    if (strategy === 'skip') return false
    return condition.negate ? true : false
  }

  const outcome = applyOperator(
    condition.operator,
    lookup.value,
    condition.value,
    { caseSensitive: condition.options?.caseSensitive ?? true },
  )
  return condition.negate ? !outcome.matched : outcome.matched
}
