import type { RenameFolderNode, RenameIfExists } from '@/lib/types/workflow'
import type { NodeValidationResult } from './types'
import { validateFolderName } from './validateFolderName'

const RENAME_STRATEGIES: RenameIfExists[] = ['fail', 'rename_incrementally']

export function validateRenameFolderConfig(
  config: Partial<RenameFolderNode['config']>
): NodeValidationResult {
  const fieldErrors: Record<string, string> = {}

  const { folderPath, newName, ifExists } = config

  if (!folderPath?.trim()) {
    fieldErrors.folderPath = 'Folder to rename is required'
  }

  const newNameError = validateFolderName(newName)
  if (newNameError) {
    fieldErrors.newName = newNameError
  }

  if (!ifExists || !RENAME_STRATEGIES.includes(ifExists)) {
    fieldErrors.ifExists = 'Conflict strategy is required'
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors, formErrors: [] }
}
