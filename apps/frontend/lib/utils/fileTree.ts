import type { FileTreeNode } from '@/lib/types/explore'

export const DEFAULT_EXPAND_DEPTH = 2

export function collectDirectoryIds(node: FileTreeNode, ids: Set<string>, maxLevel: number = DEFAULT_EXPAND_DEPTH) {
  if (node.type === 'directory' && node.level <= maxLevel) {
    ids.add(node.id)
  }
  if (node.children) {
    node.children.forEach(child => collectDirectoryIds(child, ids, maxLevel))
  }
}

export function initialExpandedIds(root: FileTreeNode): Set<string> {
  const ids = new Set<string>()
  collectDirectoryIds(root, ids)
  return ids
}
