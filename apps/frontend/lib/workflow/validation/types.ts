export interface NodeValidationResult {
  valid: boolean
  fieldErrors: Record<string, string>
  formErrors: string[]
}
