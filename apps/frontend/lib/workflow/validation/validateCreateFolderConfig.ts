import type { CreateFolderNode } from '@/lib/types/workflow'
import type { NodeValidationResult } from './types'
import { validateFolderName } from './validateFolderName'

export function validateCreateFolderConfig(
  config: Partial<CreateFolderNode['config']>
): NodeValidationResult {
  const fieldErrors: Record<string, string> = {}

  const { folderName, parentFolderPath, ifExists } = config

  const folderNameError = validateFolderName(folderName)
  if (folderNameError) {
    fieldErrors.folderName = folderNameError
  }

  if (!parentFolderPath?.trim()) {
    fieldErrors.parentFolderPath = 'Parent folder is required'
  }

  if (!ifExists) {
    fieldErrors.ifExists = 'Conflict strategy is required'
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors, formErrors: [] }
}
