export type NodeKind = 'trigger' | 'general' | 'create'

export interface NodeDescriptor {
  kind: NodeKind
  nodeType: string
  triggerId?: string
  label: string
}
