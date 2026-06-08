import type { AiClassifierNode } from '@/lib/types/workflow'
import type { NodeValidationResult } from './types'

export function validateAiClassifierConfig(
  config: AiClassifierNode['config'],
): NodeValidationResult {
  const fieldErrors: Record<string, string> = {}

  if (!config.categoryIds || config.categoryIds.length === 0) {
    fieldErrors.categoryIds = 'Select at least one category.'
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    formErrors: [],
  }
}
