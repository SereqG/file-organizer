import { useMemo } from 'react'
import type { WorkflowDefinition } from '@/lib/types/workflow'
import { validateIfConfig } from '@/lib/workflow/validation/validateIfConfig'
import { validateCreateFolderConfig } from '@/lib/workflow/validation/validateCreateFolderConfig'
import { validateDeleteFolderConfig } from '@/lib/workflow/validation/validateDeleteFolderConfig'
import { validateRenameFolderConfig } from '@/lib/workflow/validation/validateRenameFolderConfig'

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

    if (!connectedIds.has(definition.trigger.id)) return 'Connect the trigger to an action node'

    for (const node of definition.nodes) {
      if (!connectedIds.has(node.id)) return 'All nodes must be connected'

      if (node.type === 'if' && !validateIfConfig(node.config.conditions).valid) {
        return 'Some nodes have incomplete configuration'
      }
      if (node.type === 'createFolder' && !validateCreateFolderConfig(node.config).valid) {
        return 'Some nodes have incomplete configuration'
      }
      if (node.type === 'deleteFolder' && !validateDeleteFolderConfig(node.config).valid) {
        return 'Some nodes have incomplete configuration'
      }
      if (node.type === 'renameFolder' && !validateRenameFolderConfig(node.config).valid) {
        return 'Some nodes have incomplete configuration'
      }
    }

    return null
  }, [definition])
}
