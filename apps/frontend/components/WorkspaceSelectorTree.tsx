'use client'

import { useState } from 'react'
import { LuChevronDown, LuChevronRight, LuFolder, LuFile, LuCircle, LuCircleDot } from 'react-icons/lu'
import type { FileTreeNode } from '@/lib/types/explore'
import { initialExpandedIds } from '@/lib/utils/fileTree'
import { formatBytes } from '@/lib/utils/format'

const SKIP_REASON_LABELS: Record<string, string> = {
  PERMISSION_DENIED: 'no access',
  SYMBOLIC_LINK: 'symlink',
  ARCHIVE_NOT_SUPPORTED: 'archive',
  DEPTH_LIMIT: 'depth limit',
  IGNORED_DIRECTORY: 'ignored',
  IO_ERROR: 'I/O error',
  UNKNOWN: 'skipped',
}

interface Props {
  root: FileTreeNode
  selectedId: string
  onSelect: (node: FileTreeNode) => void
}

export function WorkspaceSelectorTree({ root, selectedId, onSelect }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => initialExpandedIds(root))

  function toggle(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div
      role="radiogroup"
      aria-label="Select workspace folder"
      className="overflow-auto max-h-[480px] rounded-xl border border-white/[0.07] bg-white/[0.02] py-3"
    >
      <SelectorNodeRenderer
        node={root}
        expandedIds={expandedIds}
        onToggle={toggle}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </div>
  )
}

interface RendererProps {
  node: FileTreeNode
  expandedIds: Set<string>
  onToggle: (id: string) => void
  selectedId: string
  onSelect: (node: FileTreeNode) => void
}

function SelectorNodeRenderer({ node, expandedIds, onToggle, selectedId, onSelect }: RendererProps) {
  const isExpanded = expandedIds.has(node.id)
  const isDir = node.type === 'directory'
  const isSkipped = node.skipped === true
  const isSelectable = isDir && !isSkipped

  return (
    <div role={isSelectable ? 'radio' : undefined} aria-checked={isSelectable ? node.id === selectedId : undefined}>
      <SelectorNodeItem
        node={node}
        isExpanded={isExpanded}
        isSelected={node.id === selectedId}
        onToggle={() => onToggle(node.id)}
        onSelect={isSelectable ? () => onSelect(node) : undefined}
      />
      {isExpanded && isDir && node.children && (
        <div role="group">
          {node.children.map(child => (
            <SelectorNodeRenderer
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ItemProps {
  node: FileTreeNode
  isExpanded: boolean
  isSelected: boolean
  onToggle: () => void
  onSelect?: () => void
}

function SelectorNodeItem({ node, isExpanded, isSelected, onToggle, onSelect }: ItemProps) {
  const isDir = node.type === 'directory'
  const isSkipped = node.skipped === true
  const indent = node.level * 20

  return (
    <div
      className={[
        'flex items-center gap-2.5 py-1 pr-4 rounded-lg transition-colors',
        onSelect ? 'cursor-pointer hover:bg-white/[0.03]' : '',
        isSelected ? 'bg-orange-500/[0.06]' : '',
      ].join(' ')}
      style={{ paddingLeft: `${indent + 12}px` }}
      onClick={onSelect}
    >
      {isDir && !isSkipped ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          tabIndex={-1}
          className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? <LuChevronDown size={13} /> : <LuChevronRight size={13} />}
        </button>
      ) : (
        <span className="shrink-0 w-3.5" />
      )}

      {isDir && !isSkipped ? (
        <span className={`shrink-0 transition-colors ${isSelected ? 'text-orange-400' : 'text-white/20'}`}>
          {isSelected ? <LuCircleDot size={14} /> : <LuCircle size={14} />}
        </span>
      ) : (
        <span className="shrink-0 w-3.5" />
      )}

      <span className={`shrink-0 ${isSkipped ? 'text-white/20' : isDir ? 'text-orange-400/70' : 'text-white/30'}`}>
        {isDir ? <LuFolder size={16} /> : <LuFile size={16} />}
      </span>

      <span className={`text-sm font-mono truncate ${isSkipped ? 'text-white/25 line-through' : isDir ? 'text-white/80' : 'text-white/40'}`}>
        {node.name}
      </span>

      {isSkipped && node.skipped_reason && (
        <span className="ml-auto shrink-0 text-xs text-white/20 bg-white/5 rounded px-2 py-0.5">
          {SKIP_REASON_LABELS[node.skipped_reason] ?? 'skipped'}
        </span>
      )}

      {!isSkipped && !isDir && node.size != null && (
        <span className="ml-auto shrink-0 text-xs text-white/25">
          {formatBytes(node.size)}
        </span>
      )}
    </div>
  )
}
