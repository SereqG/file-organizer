'use client'

import { useState } from 'react'
import { LuFolder, LuChevronDown } from 'react-icons/lu'
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
        <LuFolder size={12} className="shrink-0 text-orange-400" />
        <span className="font-mono text-xs text-white/60 max-w-xs truncate">{path}</span>
        <button
          onClick={() => setExpanded(v => !v)}
          className="ml-1 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors duration-150 cursor-pointer"
          aria-label={expanded ? 'Collapse directory tree' : 'Expand directory tree'}
        >
          <LuChevronDown size={12} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
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
