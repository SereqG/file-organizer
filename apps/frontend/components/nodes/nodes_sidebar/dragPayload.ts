import type { NodeDescriptor } from '@/lib/types/workflowNodeDescriptor'

export const NODE_DRAG_TYPE = 'application/node'

export function encodeDragPayload(descriptor: NodeDescriptor): string {
  return JSON.stringify(descriptor)
}

export function decodeDragPayload(raw: string): NodeDescriptor | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'kind' in parsed && typeof (parsed as Record<string, unknown>).kind === 'string' &&
      'nodeType' in parsed && typeof (parsed as Record<string, unknown>).nodeType === 'string' &&
      'label' in parsed && typeof (parsed as Record<string, unknown>).label === 'string'
    ) {
      return parsed as NodeDescriptor
    }
  } catch { /* swallow malformed JSON */ }
  return null
}
