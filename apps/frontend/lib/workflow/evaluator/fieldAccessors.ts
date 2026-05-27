import type { WorkflowItem } from '@/lib/types/workflow'
import { AI_FIELD_PREFIX } from '@/lib/workflow/registry/conditionFields'

export interface FieldLookup {
  found: boolean
  value: unknown
}

const NOT_FOUND: FieldLookup = { found: false, value: undefined }

export interface AccessorContext {
  depth: number
}

export function getFieldValue(item: WorkflowItem, field: string, ctx: AccessorContext): FieldLookup {
  if (field.startsWith(AI_FIELD_PREFIX)) {
    const key = field.slice(AI_FIELD_PREFIX.length)
    if (!key || !item.ai || !(key in item.ai)) return NOT_FOUND
    return { found: true, value: item.ai[key] }
  }

  switch (field) {
    case 'type': return { found: true, value: item.type }
    case 'name': return { found: true, value: item.name }
    case 'extension':
      return item.extension === undefined ? NOT_FOUND : { found: true, value: item.extension }
    case 'mime_type':
      return item.mimeType === undefined ? NOT_FOUND : { found: true, value: item.mimeType }
    case 'path': return { found: true, value: item.path }
    case 'size':
      if (item.type === 'folder') return { found: true, value: recursiveFolderSize(item) }
      return { found: true, value: item.stat.size }
    case 'created_at': return { found: true, value: item.stat.createdAt }
    case 'modified_at': return { found: true, value: item.stat.modifiedAt }
    case 'accessed_at': return { found: true, value: item.stat.accessedAt }
    case 'is_hidden': return { found: true, value: item.flags.hidden }
    case 'is_executable': return { found: true, value: item.flags.executable }
    case 'is_readable': return { found: true, value: item.flags.readable }
    case 'is_writable': return { found: true, value: item.flags.writable }
    case 'is_empty':
      if (item.type !== 'folder') return NOT_FOUND
      return { found: true, value: isFolderEmpty(item) }
    case 'children_count':
      return { found: true, value: item.children?.length ?? 0 }
    case 'depth':
      return { found: true, value: ctx.depth }
    default:
      return NOT_FOUND
  }
}

function recursiveFolderSize(item: WorkflowItem): number {
  let total = item.stat.size ?? 0
  for (const child of item.children ?? []) {
    total += child.type === 'folder' ? recursiveFolderSize(child) : (child.stat.size ?? 0)
  }
  return total
}

function isFolderEmpty(item: WorkflowItem): boolean {
  const children = item.children ?? []
  if (children.length === 0) return true
  return children.every((c) => c.type === 'folder' && isFolderEmpty(c))
}
