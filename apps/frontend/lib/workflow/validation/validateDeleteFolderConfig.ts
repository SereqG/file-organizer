import type { DeleteFolderNode } from '@/lib/types/workflow'
import type { NodeValidationResult } from './types'

export function validateDeleteFolderConfig(
  config: Partial<DeleteFolderNode['config']>
): NodeValidationResult {
  const fieldErrors: Record<string, string> = {}

  const { deleteAllEncountered, folderPaths } = config

  if (!deleteAllEncountered && (folderPaths?.length ?? 0) === 0) {
    fieldErrors.folderPaths = 'Select at least one folder to delete'
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors, formErrors: [] }
}
