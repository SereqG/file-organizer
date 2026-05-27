import type { ConditionOperator } from '@/lib/types/workflow'

const MS_PER_UNIT: Record<string, number> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  weeks: 604_800_000,
}

function applyCase(s: string, caseSensitive: boolean): string {
  return caseSensitive ? s : s.toLowerCase()
}

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return null
}

function asDateMs(v: unknown): number | null {
  if (v instanceof Date) return v.getTime()
  if (typeof v === 'string' && v) {
    const ms = Date.parse(v)
    return Number.isNaN(ms) ? null : ms
  }
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return null
}

export interface OperatorContext {
  caseSensitive: boolean
}

export interface OperatorOutcome {
  matched: boolean
  actual: unknown
  expected: unknown
}

// Local-timezone semantics for date operators is intentional per spec §7 — Date.parse and
// new Date() both honor the runtime's local TZ.
export function applyOperator(
  operator: ConditionOperator,
  actual: unknown,
  expected: unknown,
  ctx: OperatorContext,
): OperatorOutcome {
  switch (operator) {
    case 'equals':
      return { matched: equalsOp(actual, expected, ctx), actual, expected }
    case 'contains':
    case 'starts_with':
    case 'ends_with':
      return { matched: stringOp(operator, actual, expected, ctx), actual, expected }
    case 'greater_than':
    case 'less_than':
    case 'greater_or_equal':
    case 'less_or_equal':
      return { matched: numberCompare(operator, actual, expected), actual, expected }
    case 'between':
      return { matched: betweenOp(actual, expected), actual, expected }
    case 'before':
    case 'after':
      return { matched: dateCompare(operator, actual, expected), actual, expected }
    case 'within_last':
      return { matched: withinLastOp(actual, expected), actual, expected }
  }
}

function equalsOp(actual: unknown, expected: unknown, ctx: OperatorContext): boolean {
  if (typeof actual === 'string' && typeof expected === 'string') {
    return applyCase(actual, ctx.caseSensitive) === applyCase(expected, ctx.caseSensitive)
  }
  return actual === expected
}

function stringOp(operator: 'contains' | 'starts_with' | 'ends_with', actual: unknown, expected: unknown, ctx: OperatorContext): boolean {
  const a = asString(actual)
  const e = asString(expected)
  if (a === null || e === null) return false
  const aa = applyCase(a, ctx.caseSensitive)
  const ee = applyCase(e, ctx.caseSensitive)
  if (operator === 'contains') return aa.includes(ee)
  if (operator === 'starts_with') return aa.startsWith(ee)
  return aa.endsWith(ee)
}

function numberCompare(operator: 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal', actual: unknown, expected: unknown): boolean {
  const a = asNumber(actual)
  const e = asNumber(expected)
  if (a === null || e === null) return false
  if (operator === 'greater_than') return a > e
  if (operator === 'less_than') return a < e
  if (operator === 'greater_or_equal') return a >= e
  return a <= e
}

function betweenOp(actual: unknown, expected: unknown): boolean {
  if (!Array.isArray(expected) || expected.length !== 2) return false
  const [min, max] = expected
  const aNum = asNumber(actual)
  if (aNum !== null) {
    const minNum = asNumber(min)
    const maxNum = asNumber(max)
    if (minNum === null || maxNum === null) return false
    return aNum >= minNum && aNum <= maxNum
  }
  const aDate = asDateMs(actual)
  const minDate = asDateMs(min)
  const maxDate = asDateMs(max)
  if (aDate !== null && minDate !== null && maxDate !== null) {
    return aDate >= minDate && aDate <= maxDate
  }
  return false
}

function dateCompare(operator: 'before' | 'after', actual: unknown, expected: unknown): boolean {
  const a = asDateMs(actual)
  const e = asDateMs(expected)
  if (a === null || e === null) return false
  return operator === 'before' ? a < e : a > e
}

function withinLastOp(actual: unknown, expected: unknown): boolean {
  const a = asDateMs(actual)
  if (a === null) return false
  const window = parseDuration(expected)
  if (window === null) return false
  const now = Date.now()
  return a >= now - window && a <= now
}

function parseDuration(expected: unknown): number | null {
  if (!expected || typeof expected !== 'object') return null
  const obj = expected as { amount?: unknown; unit?: unknown }
  const amount = asNumber(obj.amount)
  const unit = typeof obj.unit === 'string' ? obj.unit : null
  if (amount === null || unit === null) return null
  const ms = MS_PER_UNIT[unit]
  if (ms === undefined) return null
  return amount * ms
}
