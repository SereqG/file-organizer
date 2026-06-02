import type { RenameFileNode, RenameIfExists } from '@/lib/types/workflow'
import type { NodeValidationResult } from './types'
import { validateFileName } from './validateFileName'

const RENAME_STRATEGIES: RenameIfExists[] = ['fail', 'rename_incrementally']

export function validateRenameFileConfig(
  config: Partial<RenameFileNode['config']>
): NodeValidationResult {
  const fieldErrors: Record<string, string> = {}

  const { filePath, newName, ifExists } = config

  if (!filePath?.trim()) {
    fieldErrors.filePath = 'File to rename is required'
  }

  const newNameError = validateFileName(newName)
  if (newNameError) {
    fieldErrors.newName = newNameError
  }

  if (!ifExists || !RENAME_STRATEGIES.includes(ifExists)) {
    fieldErrors.ifExists = 'Conflict strategy is required'
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors, formErrors: [] }
}
