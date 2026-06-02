import { MAX_SWITCH_CASES, MIN_SWITCH_CASES, type SwitchNode } from '@/lib/types/workflow'
import { validateIfConfig } from './validateIfConfig'
import type { NodeValidationResult } from './types'

export type { NodeValidationResult }

// A switch is valid when it has 2–8 outputs and every output's condition group is itself valid.
// Per-case field errors are re-keyed under `cases[i].…` so the modal can surface them inline,
// reusing the same group walk as the if node (validateIfConfig).
export function validateSwitchConfig(config: SwitchNode['config']): NodeValidationResult {
  const fieldErrors: Record<string, string> = {}
  const formErrors: string[] = []

  const cases = config.cases ?? []
  if (cases.length < MIN_SWITCH_CASES) {
    formErrors.push(`At least ${MIN_SWITCH_CASES} outputs are required`)
  }
  if (cases.length > MAX_SWITCH_CASES) {
    formErrors.push(`At most ${MAX_SWITCH_CASES} outputs are allowed`)
  }

  cases.forEach((switchCase, index) => {
    const caseResult = validateIfConfig(switchCase.conditions)
    for (const [key, message] of Object.entries(caseResult.fieldErrors)) {
      fieldErrors[`cases[${index}].${key}`] = message
    }
  })

  return {
    valid: formErrors.length === 0 && Object.keys(fieldErrors).length === 0,
    fieldErrors,
    formErrors,
  }
}
