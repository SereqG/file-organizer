import type { ConditionOperator } from '@/lib/types/workflow'

export type FieldValueKind = 'string' | 'number' | 'boolean' | 'date' | 'item-type' | 'ai'

export interface FieldDescriptor {
  field: string
  label: string
  valueKind: FieldValueKind
  allowedOperators: ConditionOperator[]
}

const STRING_OPS: ConditionOperator[] = ['equals', 'contains', 'starts_with', 'ends_with']
const NUMBER_OPS: ConditionOperator[] = ['equals', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal', 'between']
const BOOLEAN_OPS: ConditionOperator[] = ['equals']
const DATE_OPS: ConditionOperator[] = ['before', 'after', 'between', 'within_last']
const ITEM_TYPE_OPS: ConditionOperator[] = ['equals']

export const CONDITION_FIELDS: FieldDescriptor[] = [
  { field: 'type', label: 'Item type', valueKind: 'item-type', allowedOperators: ITEM_TYPE_OPS },
  { field: 'name', label: 'Name', valueKind: 'string', allowedOperators: STRING_OPS },
  { field: 'extension', label: 'Extension', valueKind: 'string', allowedOperators: STRING_OPS },
  { field: 'size', label: 'Size (bytes)', valueKind: 'number', allowedOperators: NUMBER_OPS },
  { field: 'created_at', label: 'Created date', valueKind: 'date', allowedOperators: DATE_OPS },
  { field: 'modified_at', label: 'Modified date', valueKind: 'date', allowedOperators: DATE_OPS },
  { field: 'accessed_at', label: 'Accessed date', valueKind: 'date', allowedOperators: DATE_OPS },
  { field: 'is_hidden', label: 'Hidden', valueKind: 'boolean', allowedOperators: BOOLEAN_OPS },
  { field: 'is_executable', label: 'Executable', valueKind: 'boolean', allowedOperators: BOOLEAN_OPS },
  { field: 'is_readable', label: 'Readable', valueKind: 'boolean', allowedOperators: BOOLEAN_OPS },
  { field: 'is_writable', label: 'Writable', valueKind: 'boolean', allowedOperators: BOOLEAN_OPS },
  { field: 'mime_type', label: 'MIME type', valueKind: 'string', allowedOperators: STRING_OPS },
  { field: 'path', label: 'Path', valueKind: 'string', allowedOperators: STRING_OPS },
  { field: 'is_empty', label: 'Empty folder', valueKind: 'boolean', allowedOperators: BOOLEAN_OPS },
  { field: 'children_count', label: 'Children count', valueKind: 'number', allowedOperators: NUMBER_OPS },
  { field: 'depth', label: 'Tree depth', valueKind: 'number', allowedOperators: NUMBER_OPS },
]

export const AI_FIELD_PREFIX = 'ai.'

const AI_OPERATORS: ConditionOperator[] = ['equals', 'contains', 'starts_with', 'ends_with']

export function isAiField(field: string): boolean {
  return field.startsWith(AI_FIELD_PREFIX) && field.length > AI_FIELD_PREFIX.length
}

export function getFieldDescriptor(field: string): FieldDescriptor | undefined {
  if (isAiField(field)) {
    return { field, label: field, valueKind: 'ai', allowedOperators: AI_OPERATORS }
  }
  return CONDITION_FIELDS.find((f) => f.field === field)
}

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'equals',
  contains: 'contains',
  starts_with: 'starts with',
  ends_with: 'ends with',
  greater_than: '>',
  less_than: '<',
  greater_or_equal: '≥',
  less_or_equal: '≤',
  between: 'between',
  before: 'before',
  after: 'after',
  within_last: 'within last',
}

export const ITEM_TYPE_VALUES = ['file', 'folder', 'symlink'] as const

export function defaultValueForKind(valueKind: FieldValueKind, operator: ConditionOperator): unknown {
  if (operator === 'between') {
    if (valueKind === 'number') return [0, 0]
    if (valueKind === 'date') return ['', '']
  }
  if (operator === 'within_last') return { amount: 7, unit: 'days' }
  switch (valueKind) {
    case 'string': return ''
    case 'number': return 0
    case 'boolean': return true
    case 'date': return ''
    case 'item-type': return 'file'
    case 'ai': return ''
    default: return ''
  }
}
