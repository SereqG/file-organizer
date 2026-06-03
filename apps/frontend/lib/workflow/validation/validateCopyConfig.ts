import type { CopyFileNode, TransferIfExists } from '@/lib/types/workflow'
import type { NodeValidationResult } from './types'

const IF_EXISTS_VALUES: TransferIfExists[] = ['fail', 'rename_incrementally', 'overwrite', 'skip']

export function validateCopyConfig(
  config: Partial<CopyFileNode['config']>
): NodeValidationResult {
  const fieldErrors: Record<string, string> = {}

  if (!config.targetPaths || config.targetPaths.length === 0) {
    fieldErrors.targetPaths = 'Select at least one target folder'
  }

  if (!config.ifExists || !IF_EXISTS_VALUES.includes(config.ifExists)) {
    fieldErrors.ifExists = 'Conflict strategy is required'
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors, formErrors: [] }
}
