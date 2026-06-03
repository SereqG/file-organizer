import type { MoveFileNode, TransferIfExists } from '@/lib/types/workflow'
import type { NodeValidationResult } from './types'

const IF_EXISTS_VALUES: TransferIfExists[] = ['fail', 'rename_incrementally', 'overwrite', 'skip']

export function validateMoveConfig(
  config: Partial<MoveFileNode['config']>
): NodeValidationResult {
  const fieldErrors: Record<string, string> = {}

  if (!config.targetPath?.trim()) {
    fieldErrors.targetPath = 'Target folder is required'
  }

  if (!config.ifExists || !IF_EXISTS_VALUES.includes(config.ifExists)) {
    fieldErrors.ifExists = 'Conflict strategy is required'
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors, formErrors: [] }
}
