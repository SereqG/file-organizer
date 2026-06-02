import type { DeleteFileNode } from '@/lib/types/workflow'
import type { NodeValidationResult } from './types'

export function validateDeleteFileConfig(
  config: Partial<DeleteFileNode['config']>
): NodeValidationResult {
  const fieldErrors: Record<string, string> = {}

  const { deleteAllEncountered, filePaths } = config

  if (!deleteAllEncountered && (filePaths?.length ?? 0) === 0) {
    fieldErrors.filePaths = 'Select at least one file to delete'
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors, formErrors: [] }
}
