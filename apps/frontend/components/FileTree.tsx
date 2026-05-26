'use client'

import { useState } from 'react'
import type { FileTreeNode } from '@/lib/types/explore'
import { FileTreeNodeItem } from './FileTreeNodeItem'

interface Props {
  root: FileTreeNode
}

export function FileTree({ root }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>()
    collectDirectoryIds(root, ids, 2)
    return ids
  })

  function toggle(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="overflow-auto max-h-[560px] rounded-xl border border-white/[0.07] bg-white/[0.02] py-3">
      <NodeRenderer node={root} expandedIds={expandedIds} onToggle={toggle} />
    </div>
  )
}

interface RendererProps {
  node: FileTreeNode
  expandedIds: Set<string>
  onToggle: (id: string) => void
}

function NodeRenderer({ node, expandedIds, onToggle }: RendererProps) {
  const isExpanded = expandedIds.has(node.id)

  return (
    <div>
      <FileTreeNodeItem
        node={node}
        isExpanded={isExpanded}
        onToggle={() => onToggle(node.id)}
      />
      {isExpanded && node.children && node.children.map(child => (
        <NodeRenderer key={child.id} node={child} expandedIds={expandedIds} onToggle={onToggle} />
      ))}
    </div>
  )
}

function collectDirectoryIds(node: FileTreeNode, ids: Set<string>, maxLevel: number) {
  if (node.type === 'directory' && node.level <= maxLevel) {
    ids.add(node.id)
  }
  if (node.children) {
    node.children.forEach(child => collectDirectoryIds(child, ids, maxLevel))
  }
}
