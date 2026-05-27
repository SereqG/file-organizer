export type NodeKind = 'trigger' | 'general'

export interface NodeDescriptor {
  kind: NodeKind
  nodeType: string
  triggerId?: string
  label: string
}
