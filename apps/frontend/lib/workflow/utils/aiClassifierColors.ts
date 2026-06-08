export const AI_CLASSIFIER_OUTPUT_COLORS = [
  '#a78bfa', // violet
  '#818cf8', // indigo
  '#60a5fa', // blue
  '#34d399', // emerald
  '#f472b6', // pink
  '#fbbf24', // amber
  '#22d3ee', // cyan
  '#f43f5e', // rose
] as const

export const AI_CLASSIFIER_UNCLASSIFIED_COLOR = '#9ca3af'

export function aiClassifierOutputColor(index: number): string {
  return AI_CLASSIFIER_OUTPUT_COLORS[index % AI_CLASSIFIER_OUTPUT_COLORS.length]
}
