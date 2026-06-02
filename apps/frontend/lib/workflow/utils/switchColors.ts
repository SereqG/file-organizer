// Distinct colors for the switch node's outputs, applied to both the output handles and the
// edges/traces leaving them. Hex values (not Tailwind classes) because the color is chosen at
// runtime by output index and must also feed React Flow edge `style.stroke` — dynamic
// `border-${color}` class names cannot be statically extracted by Tailwind's purge step.

export const SWITCH_OUTPUT_COLORS = [
  '#34d399', // emerald
  '#f43f5e', // rose
  '#38bdf8', // sky
  '#a78bfa', // violet
  '#fbbf24', // amber
  '#22d3ee', // cyan
  '#f472b6', // pink
  '#a3e635', // lime
] as const

// Neutral gray for the always-present "everything else" default output.
export const SWITCH_DEFAULT_COLOR = '#9ca3af'

export function switchOutputColor(index: number): string {
  return SWITCH_OUTPUT_COLORS[index % SWITCH_OUTPUT_COLORS.length]
}
