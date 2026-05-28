import type { FileTreeNode } from '@/lib/types/explore'
import { formatBytes } from '@/lib/utils/format'

interface Props {
  node: FileTreeNode
  isExpanded: boolean
  onToggle: () => void
  isFocused: boolean
}

const SKIP_REASON_LABELS: Record<string, string> = {
  PERMISSION_DENIED: 'no access',
  SYMBOLIC_LINK: 'symlink',
  ARCHIVE_NOT_SUPPORTED: 'archive',
  DEPTH_LIMIT: 'depth limit',
  IGNORED_DIRECTORY: 'ignored',
  IO_ERROR: 'I/O error',
  UNKNOWN: 'skipped',
}

export function FileTreeNodeItem({ node, isExpanded, onToggle, isFocused }: Props) {
  const isDir = node.type === 'directory'
  const isSkipped = node.skipped === true
  const indent = node.level * 20

  return (
    <div
      className={`flex items-center gap-2.5 py-1 pr-4 rounded-lg group hover:bg-white/[0.03] transition-colors ${isFocused ? 'bg-white/[0.04] ring-1 ring-inset ring-white/10' : ''}`}
      style={{ paddingLeft: `${indent + 12}px` }}
    >
      {isDir && !isSkipped ? (
        <button
          onClick={onToggle}
          tabIndex={-1}
          className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path
              d={isExpanded ? 'M2 4l4 4 4-4' : 'M4 2l4 4-4 4'}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : (
        <span className="shrink-0 w-3.5" />
      )}

      <span className={`shrink-0 ${isSkipped ? 'text-white/20' : isDir ? 'text-orange-400/70' : 'text-white/40'}`}>
        {isDir ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 5a1.5 1.5 0 0 1 1.5-1.5h3l1 1h5A1.5 1.5 0 0 1 14 6v5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11V5z"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 2h6l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        )}
      </span>

      <span className={`text-sm font-mono truncate ${isSkipped ? 'text-white/25 line-through' : 'text-white/80'}`}>
        {node.name}
      </span>

      {isSkipped && node.skipped_reason && (
        <span className="ml-auto shrink-0 text-xs text-white/20 bg-white/5 rounded px-2 py-0.5">
          {SKIP_REASON_LABELS[node.skipped_reason] ?? 'skipped'}
        </span>
      )}

      {!isSkipped && node.type === 'file' && node.size != null && (
        <span className="ml-auto shrink-0 text-xs text-white/25">
          {formatBytes(node.size)}
        </span>
      )}
    </div>
  )
}
