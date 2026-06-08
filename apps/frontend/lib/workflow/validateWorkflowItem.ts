import type { WorkflowItem } from '@/lib/types/workflow'

type ValidationResult =
  | { ok: true; item: WorkflowItem }
  | { ok: false; error: string }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateStat(value: unknown): string | null {
  if (!isObject(value)) return '"stat" must be an object'
  if (typeof value.size !== 'number') return '"stat.size" must be a number'
  if (typeof value.createdAt !== 'string') return '"stat.createdAt" must be a string'
  if (typeof value.modifiedAt !== 'string') return '"stat.modifiedAt" must be a string'
  if (typeof value.accessedAt !== 'string') return '"stat.accessedAt" must be a string'
  return null
}

function validateFlags(value: unknown): string | null {
  if (!isObject(value)) return '"flags" must be an object'
  if (typeof value.hidden !== 'boolean') return '"flags.hidden" must be a boolean'
  if (typeof value.executable !== 'boolean') return '"flags.executable" must be a boolean'
  if (typeof value.readable !== 'boolean') return '"flags.readable" must be a boolean'
  if (typeof value.writable !== 'boolean') return '"flags.writable" must be a boolean'
  return null
}

export function validateWorkflowItem(value: unknown): ValidationResult {
  if (!isObject(value)) return { ok: false, error: 'WorkflowItem must be an object' }

  if (typeof value.id !== 'string') return { ok: false, error: '"id" must be a string' }
  if (typeof value.path !== 'string') return { ok: false, error: '"path" must be a string' }
  if (typeof value.name !== 'string') return { ok: false, error: '"name" must be a string' }

  const validTypes = ['file', 'folder', 'symlink']
  if (!validTypes.includes(value.type as string))
    return { ok: false, error: `"type" must be one of: ${validTypes.join(', ')}` }

  if (value.extension !== undefined && typeof value.extension !== 'string')
    return { ok: false, error: '"extension" must be a string' }
  if (value.mimeType !== undefined && typeof value.mimeType !== 'string')
    return { ok: false, error: '"mimeType" must be a string' }

  const statError = validateStat(value.stat)
  if (statError) return { ok: false, error: statError }

  const flagsError = validateFlags(value.flags)
  if (flagsError) return { ok: false, error: flagsError }

  if (value.children !== undefined && !Array.isArray(value.children))
    return { ok: false, error: '"children" must be an array' }

  if (value.ai !== undefined && !isObject(value.ai))
    return { ok: false, error: '"ai" must be an object' }

  return { ok: true, item: value as unknown as WorkflowItem }
}
