import type { CreateFolderNode } from '@/lib/types/workflow'

const FORBIDDEN_CHARS = /[<>:"/\\|?*]/
const RESERVED_WINDOWS = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i
const MAX_NAME_LENGTH = 30

export interface CreateFolderValidationResult {
  valid: boolean
  errors: Partial<Record<keyof CreateFolderNode['config'], string>>
}

export function validateCreateFolderConfig(
  config: Partial<CreateFolderNode['config']>
): CreateFolderValidationResult {
  const errors: Partial<Record<keyof CreateFolderNode['config'], string>> = {}

  const { folderName, parentFolderId, ifExists } = config

  if (!folderName) {
    errors.folderName = 'Folder name is required'
  } else if (folderName.length > MAX_NAME_LENGTH) {
    errors.folderName = `Folder name must be at most ${MAX_NAME_LENGTH} characters`
  } else if (FORBIDDEN_CHARS.test(folderName)) {
    errors.folderName = 'Folder name contains forbidden characters: < > : " / \\ | ? *'
  } else if (folderName === '.' || folderName === '..' || folderName.startsWith('~/')) {
    errors.folderName = 'Folder name contains a forbidden token'
  } else if (folderName.endsWith(' ') || folderName.endsWith('.')) {
    errors.folderName = 'Folder name must not end with a space or dot'
  } else if (RESERVED_WINDOWS.test(folderName)) {
    errors.folderName = 'Folder name is a reserved system name'
  }

  if (!parentFolderId?.trim()) {
    errors.parentFolderId = 'Parent folder ID is required'
  }

  if (!ifExists) {
    errors.ifExists = 'Conflict strategy is required'
  }

  return { valid: Object.keys(errors).length === 0, errors }
}
