'use client'

import { useState } from 'react'
import type { NodeDescriptor } from '@/lib/types/workflowNodeDescriptor'
import type { NodeCategory } from '@/lib/workflow/registry/nodeCatalog'
import { LuChevronRight } from 'react-icons/lu'
import { NodeItem } from './NodeItem'

interface CategorySectionProps extends NodeCategory {
  disabled?: boolean
  isAiAvailable?: boolean
  onAddNode: (entry: NodeDescriptor) => void
}

export function CategorySection({ name, nodes, disabled, isAiAvailable, onAddNode }: CategorySectionProps) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-white/40 hover:text-white/70 transition-colors"
      >
        <LuChevronRight size={12} className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
        <span className="text-[11px] font-medium uppercase tracking-wider">{name}</span>
      </button>

      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5 px-1">
          {nodes.map((node) => (
            <NodeItem key={node.label} {...node} disabled={disabled} isAiAvailable={isAiAvailable} onAddNode={onAddNode} />
          ))}
        </div>
      )}
    </div>
  )
}
