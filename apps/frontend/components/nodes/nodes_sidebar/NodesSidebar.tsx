'use client'

import { useState } from 'react'
import type { NodeDescriptor } from '@/lib/types/workflowNodeDescriptor'
import { NODE_CATEGORIES } from '@/lib/workflow/registry/nodeCatalog'
import { useOpenRouterKey } from '@/lib/workflow/stores/openRouterKey'
import { CategorySection } from './CategorySection'

interface NodesSidebarProps {
  triggerDisabled?: boolean
  onAddNode: (entry: NodeDescriptor) => void
}

export function NodesSidebar({ onAddNode, triggerDisabled }: NodesSidebarProps) {
  const [expanded, setExpanded] = useState(true)
  const { isAiAvailable } = useOpenRouterKey()

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col rounded-lg border border-white/10 bg-[#111] overflow-hidden">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-2.5 text-white/50 hover:text-white/80 transition-colors border-b border-white/10"
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`transition-transform duration-200 ${expanded ? '' : 'rotate-180'}`}
        >
          <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {expanded && <span className="text-xs font-medium text-white/60">Nodes</span>}
      </button>

      {expanded && (
        <div className="flex flex-col gap-1 py-2 w-44">
          {NODE_CATEGORIES.map((category) => (
            <CategorySection
              key={category.name}
              {...category}
              disabled={category.name === 'Triggers' ? triggerDisabled : false}
              isAiAvailable={isAiAvailable}
              onAddNode={onAddNode}
            />
          ))}
        </div>
      )}
    </div>
  )
}
