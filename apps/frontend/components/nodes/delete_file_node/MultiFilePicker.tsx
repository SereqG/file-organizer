'use client'

import { useState } from 'react'
import type { FileTreeNode } from '@/lib/types/explore'
import { initialExpandedIds } from '@/lib/utils/fileTree'
import { useTreeKeyboardNav } from '@/hooks/useTreeKeyboardNav'

const fileFilter = (n: FileTreeNode) => n.type === 'file'

interface MultiFilePickerProps {
  root: FileTreeNode
  selectedPaths: string[]
  onToggle: (path: string) => void
  disabled?: boolean
}

export function MultiFilePicker({ root, selectedPaths, onToggle, disabled }: MultiFilePickerProps) {
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
    filter: fileFilter,
  })

  return (
    <div
      role="tree"
      aria-label="Files to delete"
      aria-multiselectable="true"
      className={`overflow-auto max-h-48 rounded-lg border border-white/10 bg-[#0d0d0d] py-1 ${disabled ? 'pointer-events-none opacity-40' : ''}`}
    >
      <TreeNode
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

interface TreeNodeProps {
  node: FileTreeNode
  expandedIds: Set<string>
  selected: Set<string>
  onToggleExpand: (id: string) => void
  onToggleSelect: (path: string) => void
  keyboardNav: KeyboardNav
}

function TreeNode({ node, expandedIds, selected, onToggleExpand, onToggleSelect, keyboardNav }: TreeNodeProps) {
  const isSkipped = node.skipped === true
  const indent = node.level * 16
  const isFocused = keyboardNav.focusedId === node.id

  if (node.type === 'directory') {
    const isExpanded = expandedIds.has(node.id)
    const hasChildren = (node.children?.length ?? 0) > 0

    return (
      <div
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={false}
        tabIndex={keyboardNav.getTabIndex(node.id)}
        onKeyDown={(e) => { e.stopPropagation(); keyboardNav.handleItemKeyDown(e, node) }}
        onFocus={(e) => { e.stopPropagation(); keyboardNav.onItemFocus(node.id) }}
        ref={(el) => keyboardNav.registerRef(node.id, el)}
        className="outline-none"
      >
        <div
          onClick={() => { if (hasChildren) onToggleExpand(node.id) }}
          className={`flex items-center gap-2 py-1 pr-3 rounded-md transition-colors ${
            isFocused ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
          } ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
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

          <span className="text-sky-500/60">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 5a1.5 1.5 0 0 1 1.5-1.5h3l1 1h5A1.5 1.5 0 0 1 14 6v5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11V5z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </span>

          <span className="text-xs font-mono truncate text-white/50">{node.name}</span>
        </div>

        {isExpanded && (
          <div role="group">
            {node.children?.map(child => (
              <TreeNode
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

  const isSelected = selected.has(node.path)

  return (
    <div
      role="treeitem"
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
        style={{ paddingLeft: `${indent + 10 + 18}px` }}
      >
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
    </div>
  )
}
