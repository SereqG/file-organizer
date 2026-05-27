import type { ConditionGroup, MissingFieldStrategy, WorkflowItem } from '@/lib/types/workflow'
import { evaluate } from './evaluate'

export interface RouteOptions {
  missingFieldStrategy?: MissingFieldStrategy
  rootDepth?: number
}

export interface RouteResult {
  true: WorkflowItem[]
  false: WorkflowItem[]
}

export async function route(
  items: WorkflowItem[],
  group: ConditionGroup,
  opts: RouteOptions = {},
): Promise<RouteResult> {
  const result: RouteResult = { true: [], false: [] }
  const depth = opts.rootDepth ?? 0
  for (const item of items) {
    const matched = await evaluate(item, group, {
      missingFieldStrategy: opts.missingFieldStrategy,
      depth,
    })
    if (matched) result.true.push(item)
    else result.false.push(item)
  }
  return result
}
