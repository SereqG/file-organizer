import { useMemo } from 'react'
import type { WorkflowDefinition } from '@/lib/types/workflow'
import { validateIfConfig } from '@/lib/workflow/validation/validateIfConfig'
import { validateCreateFolderConfig } from '@/lib/workflow/validation/validateCreateFolderConfig'

// Returns null when the workflow is ready to run, or a reason string when it is not.
export function useWorkflowReadiness(definition: WorkflowDefinition | null): string | null {
  return useMemo(() => {
    if (!definition) return 'Add a trigger to run the workflow'
    if (definition.nodes.length === 0) return 'Add at least one action node'

    const connectedIds = new Set<string>()
    for (const edge of definition.edges) {
      connectedIds.add(edge.source)
      connectedIds.add(edge.target)
    }

    console.log('Connected node IDs:', connectedIds)
    console.log('Trigger node ID:', definition.trigger.id)
    console.log("workflow definition:", definition)

    if (!connectedIds.has(definition.trigger.id)) return 'Connect the trigger to an action node'

    for (const node of definition.nodes) {
      if (!connectedIds.has(node.id)) return 'All nodes must be connected'

      if (node.type === 'if' && !validateIfConfig(node.config.conditions).valid) {
        return 'Some nodes have incomplete configuration'
      }
      if (node.type === 'createFolder' && !validateCreateFolderConfig(node.config).valid) {
        return 'Some nodes have incomplete configuration'
      }
    }

    return null
  }, [definition])
}
