'use client'

import { useState } from 'react'
import type { FileTreeNode } from '@/lib/types/explore'
import { FileTree } from './FileTree'

interface WorkspaceIndicatorProps {
  path: string
  tree: FileTreeNode
}

export function WorkspaceIndicator({ path, tree }: WorkspaceIndicatorProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 backdrop-blur-md px-4 py-2 pointer-events-auto">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 text-orange-400">
          <path
            d="M1 3.5C1 2.67 1.67 2 2.5 2H4.38C4.72 2 5.04 2.15 5.25 2.41L6 3.33H9.5C10.33 3.33 11 4 11 4.83V8.5C11 9.33 10.33 10 9.5 10H2.5C1.67 10 1 9.33 1 8.5V3.5Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        <span className="font-mono text-xs text-white/60 max-w-xs truncate">{path}</span>
        <button
          onClick={() => setExpanded(v => !v)}
          className="ml-1 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors duration-150 cursor-pointer"
          aria-label={expanded ? 'Collapse directory tree' : 'Expand directory tree'}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="mt-2 w-96 rounded-xl border border-white/10 bg-black/80 backdrop-blur-md overflow-hidden pointer-events-auto">
          <FileTree root={tree} />
        </div>
      )}
    </div>
  )
}
