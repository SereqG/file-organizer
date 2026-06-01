'use client'

import { useState } from 'react'
import type { FileTreeNode } from '@/lib/types/explore'
import { initialExpandedIds } from '@/lib/utils/fileTree'
import { useTreeKeyboardNav } from '@/hooks/useTreeKeyboardNav'

const directoryFilter = (n: FileTreeNode) => n.type === 'directory'

interface MultiFolderPickerProps {
  root: FileTreeNode
  selectedPaths: string[]
  onToggle: (path: string) => void
  disabled?: boolean
}

export function MultiFolderPicker({ root, selectedPaths, onToggle, disabled }: MultiFolderPickerProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => initialExpandedIds(root))
  const selected = new Set(selectedPaths)

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const keyboardNav = useTreeKeyboardNav({
    root,
    expandedIds,
    onToggle: toggleExpand,
    onSelect: disabled ? undefined : (node) => onToggle(node.path),
    filter: directoryFilter,
  })

  return (
    <div
      role="tree"
      aria-label="Folders to delete"
      aria-multiselectable="true"
      className={`overflow-auto max-h-48 rounded-lg border border-white/10 bg-[#0d0d0d] py-1 ${disabled ? 'pointer-events-none opacity-40' : ''}`}
    >
      <FolderNode
        node={root}
        expandedIds={expandedIds}
        selected={selected}
        onToggleExpand={toggleExpand}
        onToggleSelect={onToggle}
        keyboardNav={keyboardNav}
      />
    </div>
  )
}

type KeyboardNav = ReturnType<typeof useTreeKeyboardNav>

interface FolderNodeProps {
  node: FileTreeNode
  expandedIds: Set<string>
  selected: Set<string>
  onToggleExpand: (id: string) => void
  onToggleSelect: (path: string) => void
  keyboardNav: KeyboardNav
}

function FolderNode({ node, expandedIds, selected, onToggleExpand, onToggleSelect, keyboardNav }: FolderNodeProps) {
  if (node.type !== 'directory') return null

  const isExpanded = expandedIds.has(node.id)
  const isSelected = selected.has(node.path)
  const isSkipped = node.skipped === true
  const indent = node.level * 16
  const hasChildren = node.children?.some(c => c.type === 'directory') ?? false
  const isFocused = keyboardNav.focusedId === node.id

  return (
    <div
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      tabIndex={keyboardNav.getTabIndex(node.id)}
      onKeyDown={(e) => { e.stopPropagation(); keyboardNav.handleItemKeyDown(e, node) }}
      onFocus={(e) => { e.stopPropagation(); keyboardNav.onItemFocus(node.id) }}
      ref={(el) => keyboardNav.registerRef(node.id, el)}
      className="outline-none"
    >
      <div
        onClick={() => { if (!isSkipped) onToggleSelect(node.path) }}
        className={`flex items-center gap-2 py-1 pr-3 rounded-md transition-colors ${
          isSkipped
            ? 'cursor-default opacity-40'
            : isSelected
              ? 'bg-rose-500/20 cursor-pointer'
              : isFocused
                ? 'bg-white/[0.06] cursor-pointer'
                : 'hover:bg-white/[0.04] cursor-pointer'
        }`}
        style={{ paddingLeft: `${indent + 10}px` }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggleExpand(node.id) }}
          tabIndex={-1}
          className={`shrink-0 transition-colors ${hasChildren ? 'text-white/30 hover:text-white/60' : 'text-transparent cursor-default'}`}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d={isExpanded ? 'M2 4l4 4 4-4' : 'M4 2l4 4-4 4'}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <input
          type="checkbox"
          checked={isSelected}
          disabled={isSkipped}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          onChange={() => { if (!isSkipped) onToggleSelect(node.path) }}
          className="h-3 w-3 shrink-0 accent-rose-500"
          aria-label={`Select ${node.name}`}
        />

        <span className={`text-xs font-mono truncate ${isSelected ? 'text-rose-300' : 'text-white/70'}`}>
          {node.name}
        </span>
      </div>

      {isExpanded && (
        <div role="group">
          {node.children?.map(child => (
            <FolderNode
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              selected={selected}
              onToggleExpand={onToggleExpand}
              onToggleSelect={onToggleSelect}
              keyboardNav={keyboardNav}
            />
          ))}
        </div>
      )}
    </div>
  )
}
