import type { WorkflowNode } from '@/lib/types/workflow'
import { PREDEFINED_CATEGORIES, loadCustomCategories } from '@/lib/workflow/stores/categoryLibrary'

/**
 * Expand each AI Classifier node's `categoryIds` into the full category objects the backend expects.
 * Shared by the preview, the run, and the per-node simulation so all three send identical node
 * configs — which is what makes the preview/run consistency token and the AI cache line up.
 */
export function resolveRunNodes(nodes: WorkflowNode[]): WorkflowNode[] {
  const library = [...PREDEFINED_CATEGORIES, ...loadCustomCategories()]
  const byId = new Map(library.map((c) => [c.id, c]))

  return nodes.map((node) => {
    if (node.type !== 'ai_classifier') return node
    const categories = node.config.categoryIds
      .map((id) => byId.get(id))
      .filter(Boolean)
    return {
      ...node,
      config: {
        categories,
        allowDuplicate: node.config.allowDuplicate,
      },
    } as unknown as WorkflowNode
  })
}
