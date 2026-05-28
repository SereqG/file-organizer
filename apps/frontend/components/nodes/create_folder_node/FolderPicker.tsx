'use client'

import { useState } from 'react'
import type { FileTreeNode } from '@/lib/types/explore'

interface FolderPickerProps {
  root: FileTreeNode
  selectedId: string | null
  onSelect: (node: FileTreeNode) => void
}

export function FolderPicker({ root, selectedId, onSelect }: FolderPickerProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>()
    collectDirectoryIds(root, ids, 2)
    return ids
  })

  function toggle(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="overflow-auto max-h-48 rounded-lg border border-white/10 bg-[#0d0d0d] py-1">
      <FolderNode
        node={root}
        expandedIds={expandedIds}
        selectedId={selectedId}
        onToggle={toggle}
        onSelect={onSelect}
      />
    </div>
  )
}

interface FolderNodeProps {
  node: FileTreeNode
  expandedIds: Set<string>
  selectedId: string | null
  onToggle: (id: string) => void
  onSelect: (node: FileTreeNode) => void
}

function FolderNode({ node, expandedIds, selectedId, onToggle, onSelect }: FolderNodeProps) {
  if (node.type !== 'directory') return null

  const isExpanded = expandedIds.has(node.id)
  const isSelected = node.id === selectedId
  const isSkipped = node.skipped === true
  const indent = node.level * 16
  const hasChildren = node.children?.some(c => c.type === 'directory') ?? false

  return (
    <div>
      <div
        onClick={() => { if (!isSkipped) onSelect(node) }}
        className={`flex items-center gap-2 py-1 pr-3 rounded-md transition-colors ${
          isSkipped
            ? 'cursor-default opacity-40'
            : isSelected
              ? 'bg-sky-500/20 cursor-pointer'
              : 'hover:bg-white/[0.04] cursor-pointer'
        }`}
        style={{ paddingLeft: `${indent + 10}px` }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggle(node.id) }}
          className={`shrink-0 transition-colors ${hasChildren ? 'text-white/30 hover:text-white/60' : 'text-transparent cursor-default'}`}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          tabIndex={hasChildren ? 0 : -1}
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

        <span className={isSelected ? 'text-sky-400' : 'text-sky-500/60'}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 5a1.5 1.5 0 0 1 1.5-1.5h3l1 1h5A1.5 1.5 0 0 1 14 6v5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11V5z"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </span>

        <span className={`text-xs font-mono truncate ${isSelected ? 'text-sky-300' : 'text-white/70'}`}>
          {node.name}
        </span>
      </div>

      {isExpanded && node.children?.map(child => (
        <FolderNode
          key={child.id}
          node={child}
          expandedIds={expandedIds}
          selectedId={selectedId}
          onToggle={onToggle}
          onSelect={onSelect}
        />
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

export function findNodeById(root: FileTreeNode, id: string): FileTreeNode | null {
  if (root.id === id) return root
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeById(child, id)
      if (found) return found
    }
  }
  return null
}
