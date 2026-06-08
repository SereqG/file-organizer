export type ItemType = 'file' | 'folder' | 'both'
export type MinConfidence = 'low' | 'medium' | 'high'
export type UnclassifiedStrategy = 'pass_through' | 'collect' | 'error'

export interface Category {
  id: string
  name: string
  description: string
  itemType: ItemType
  extensions: string[]
  minConfidence: MinConfidence
  isPredefined: boolean
}

export const RESERVED_CATEGORY_NAME = '_unclassified'

export const CONFIDENCE_LABELS: Record<MinConfidence, string> = {
  low: 'Low (≥ 40%)',
  medium: 'Medium (≥ 65%)',
  high: 'High (≥ 85%)',
}
