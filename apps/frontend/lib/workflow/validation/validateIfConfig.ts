import {
  MAX_GROUP_DEPTH,
  isConditionGroup,
  type Condition,
  type ConditionGroup,
} from '@/lib/types/workflow'
import { getFieldDescriptor, isAiField } from '@/lib/workflow/registry/conditionFields'

export interface ValidationError {
  path: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export function validateIfConfig(root: ConditionGroup): ValidationResult {
  const errors: ValidationError[] = []
  validateGroup(root, 'conditions', 0, errors)
  return { valid: errors.length === 0, errors }
}

function validateGroup(group: ConditionGroup, path: string, depth: number, errors: ValidationError[]): void {
  if (depth >= MAX_GROUP_DEPTH) {
    errors.push({ path, message: `Maximum nesting depth (${MAX_GROUP_DEPTH}) exceeded` })
    return
  }

  if (group.children.length === 0) {
    errors.push({ path, message: 'Group must contain at least one condition' })
    return
  }

  group.children.forEach((child, index) => {
    const childPath = `${path}.children[${index}]`
    if (isConditionGroup(child)) {
      validateGroup(child, childPath, depth + 1, errors)
    } else {
      validateCondition(child, childPath, errors)
    }
  })
}

function validateCondition(condition: Condition, path: string, errors: ValidationError[]): void {
  if (!condition.field || condition.field.trim() === '') {
    errors.push({ path, message: 'Field is required' })
    return
  }

  if (isAiField(condition.field) && condition.field === 'ai.') {
    errors.push({ path: `${path}.field`, message: 'AI field must include a key after "ai."' })
    return
  }

  const descriptor = getFieldDescriptor(condition.field)
  if (!descriptor) {
    errors.push({ path: `${path}.field`, message: `Unknown field: ${condition.field}` })
    return
  }

  if (!descriptor.allowedOperators.includes(condition.operator)) {
    errors.push({
      path: `${path}.operator`,
      message: `Operator "${condition.operator}" not allowed for field "${condition.field}"`,
    })
    return
  }

  if (condition.value === undefined || condition.value === null || condition.value === '') {
    errors.push({ path: `${path}.value`, message: 'Value is required' })
    return
  }

  if (condition.operator === 'between') {
    if (!Array.isArray(condition.value) || condition.value.length !== 2) {
      errors.push({ path: `${path}.value`, message: 'Between requires two values' })
      return
    }
    const [a, b] = condition.value
    if (a === '' || a === null || a === undefined || b === '' || b === null || b === undefined) {
      errors.push({ path: `${path}.value`, message: 'Both values are required for between' })
    }
  }
}
