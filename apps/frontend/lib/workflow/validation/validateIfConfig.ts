import {
  MAX_GROUP_DEPTH,
  isConditionGroup,
  type Condition,
  type ConditionGroup,
} from '@/lib/types/workflow'
import { getFieldDescriptor, isAiField } from '@/lib/workflow/registry/conditionFields'
import type { NodeValidationResult } from './types'

export type { NodeValidationResult }

export function validateIfConfig(root: ConditionGroup): NodeValidationResult {
  const fieldErrors: Record<string, string> = {}
  validateGroup(root, 'conditions', 0, fieldErrors)
  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors, formErrors: [] }
}

function addError(fieldErrors: Record<string, string>, path: string, message: string): void {
  if (!(path in fieldErrors)) fieldErrors[path] = message
}

function validateGroup(group: ConditionGroup, path: string, depth: number, fieldErrors: Record<string, string>): void {
  if (depth >= MAX_GROUP_DEPTH) {
    addError(fieldErrors, path, `Maximum nesting depth (${MAX_GROUP_DEPTH}) exceeded`)
    return
  }

  if (group.children.length === 0) {
    addError(fieldErrors, path, 'Group must contain at least one condition')
    return
  }

  group.children.forEach((child, index) => {
    const childPath = `${path}.children[${index}]`
    if (isConditionGroup(child)) {
      validateGroup(child, childPath, depth + 1, fieldErrors)
    } else {
      validateCondition(child, childPath, fieldErrors)
    }
  })
}

function validateCondition(condition: Condition, path: string, fieldErrors: Record<string, string>): void {
  if (!condition.field || condition.field.trim() === '') {
    addError(fieldErrors, path, 'Field is required')
    return
  }

  if (isAiField(condition.field) && condition.field === 'ai.') {
    addError(fieldErrors, `${path}.field`, 'AI field must include a key after "ai."')
    return
  }

  const descriptor = getFieldDescriptor(condition.field)
  if (!descriptor) {
    addError(fieldErrors, `${path}.field`, `Unknown field: ${condition.field}`)
    return
  }

  if (!descriptor.allowedOperators.includes(condition.operator)) {
    addError(fieldErrors, `${path}.operator`, `Operator "${condition.operator}" not allowed for field "${condition.field}"`)
    return
  }

  if (condition.value === undefined || condition.value === null || condition.value === '') {
    addError(fieldErrors, `${path}.value`, 'Value is required')
    return
  }

  if (condition.operator === 'between') {
    if (!Array.isArray(condition.value) || condition.value.length !== 2) {
      addError(fieldErrors, `${path}.value`, 'Between requires two values')
      return
    }
    const [a, b] = condition.value
    if (a === '' || a === null || a === undefined || b === '' || b === null || b === undefined) {
      addError(fieldErrors, `${path}.value`, 'Both values are required for between')
    }
  }
}
