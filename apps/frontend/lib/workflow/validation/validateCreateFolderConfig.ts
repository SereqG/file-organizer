import type { CreateFolderNode } from '@/lib/types/workflow'
import type { NodeValidationResult } from './types'

const FORBIDDEN_CHARS = /[<>:"/\\|?*]/
const RESERVED_WINDOWS = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i
const MAX_NAME_LENGTH = 30

export function validateCreateFolderConfig(
  config: Partial<CreateFolderNode['config']>
): NodeValidationResult {
  const fieldErrors: Record<string, string> = {}

  const { folderName, parentFolderId, ifExists } = config

  if (!folderName) {
    fieldErrors.folderName = 'Folder name is required'
  } else if (folderName.length > MAX_NAME_LENGTH) {
    fieldErrors.folderName = `Folder name must be at most ${MAX_NAME_LENGTH} characters`
  } else if (FORBIDDEN_CHARS.test(folderName)) {
    fieldErrors.folderName = 'Folder name contains forbidden characters: < > : " / \\ | ? *'
  } else if (folderName === '.' || folderName === '..' || folderName.startsWith('~/')) {
    fieldErrors.folderName = 'Folder name contains a forbidden token'
  } else if (folderName.endsWith(' ') || folderName.endsWith('.')) {
    fieldErrors.folderName = 'Folder name must not end with a space or dot'
  } else if (RESERVED_WINDOWS.test(folderName)) {
    fieldErrors.folderName = 'Folder name is a reserved system name'
  }

  if (!parentFolderId?.trim()) {
    fieldErrors.parentFolderId = 'Parent folder ID is required'
  }

  if (!ifExists) {
    fieldErrors.ifExists = 'Conflict strategy is required'
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors, formErrors: [] }
}
