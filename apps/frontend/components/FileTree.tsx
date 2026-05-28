'use client'

import { useState } from 'react'
import type { FileTreeNode } from '@/lib/types/explore'
import { initialExpandedIds } from '@/lib/utils/fileTree'
import { FileTreeNodeItem } from './FileTreeNodeItem'
import { useTreeKeyboardNav } from '@/hooks/useTreeKeyboardNav'

interface Props {
  root: FileTreeNode
}

export function FileTree({ root }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => initialExpandedIds(root))

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

  const keyboardNav = useTreeKeyboardNav({ root, expandedIds, onToggle: toggle })

  return (
    <div
      role="tree"
      aria-label="File tree"
      className="overflow-auto max-h-[560px] rounded-xl border border-white/[0.07] bg-white/[0.02] py-3"
    >
      <NodeRenderer node={root} expandedIds={expandedIds} onToggle={toggle} keyboardNav={keyboardNav} />
    </div>
  )
}

type KeyboardNav = ReturnType<typeof useTreeKeyboardNav>

interface RendererProps {
  node: FileTreeNode
  expandedIds: Set<string>
  onToggle: (id: string) => void
  keyboardNav: KeyboardNav
}

function NodeRenderer({ node, expandedIds, onToggle, keyboardNav }: RendererProps) {
  const isExpanded = expandedIds.has(node.id)
  const isDir = node.type === 'directory'

  return (
    <div
      role="treeitem"
      aria-expanded={isDir && !node.skipped ? isExpanded : undefined}
      tabIndex={keyboardNav.getTabIndex(node.id)}
      onKeyDown={(e) => { e.stopPropagation(); keyboardNav.handleItemKeyDown(e, node) }}
      onFocus={(e) => { e.stopPropagation(); keyboardNav.onItemFocus(node.id) }}
      ref={(el) => keyboardNav.registerRef(node.id, el)}
      className="outline-none"
    >
      <FileTreeNodeItem
        node={node}
        isExpanded={isExpanded}
        onToggle={() => onToggle(node.id)}
        isFocused={keyboardNav.focusedId === node.id}
      />
      {isExpanded && isDir && node.children && (
        <div role="group">
          {node.children.map(child => (
            <NodeRenderer key={child.id} node={child} expandedIds={expandedIds} onToggle={onToggle} keyboardNav={keyboardNav} />
          ))}
        </div>
      )}
    </div>
  )
}

