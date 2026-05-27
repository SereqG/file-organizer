'use client'

import { useState } from 'react'
import type { NodeDescriptor, NodeKind } from '@/lib/types/workflowNodeDescriptor'

interface NodeEntry {
  kind: NodeKind
  nodeType: string
  triggerId?: string
  label: string
  icon: React.ReactNode
}

interface NodeCategory {
  name: string
  nodes: NodeEntry[]
}

const CATEGORIES: NodeCategory[] = [
  {
    name: 'Triggers',
    nodes: [
      {
        kind: 'trigger',
        nodeType: 'trigger',
        triggerId: 'manual',
        label: 'Manual Trigger',
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4.5 2.5V8L6 6.5H10L4.5 2.5Z"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinejoin="round"
            />
            <path
              d="M6 6.5L8 11"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
      {
        kind: 'trigger',
        nodeType: 'trigger',
        triggerId: 'schedule',
        label: 'Schedule',
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.25" />
            <path d="M7 4.5V7L8.5 8.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
    ],
  },
  {
    name: 'General',
    nodes: [
      {
        kind: 'general',
        nodeType: 'if',
        label: 'If',
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 2V6.5L7 9V12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11 2V6.5L7 9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
    ],
  },
]

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
    >
      <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface NodeItemProps extends NodeEntry {
  disabled?: boolean
  onAddNode: (entry: NodeDescriptor) => void
}

function NodeItem({ kind, nodeType, triggerId, label, icon, disabled, onAddNode }: NodeItemProps) {
  const descriptor: NodeDescriptor = { kind, nodeType, triggerId, label }

  const handleDragStart = (event: React.DragEvent) => {
    if (disabled) { event.preventDefault(); return }
    event.dataTransfer.setData('application/node', JSON.stringify(descriptor))
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-35'
          : 'cursor-grab text-white/60 hover:bg-white/5 hover:text-white/90 active:cursor-grabbing'
      }`}
      draggable={!disabled}
      onClick={() => { if (!disabled) onAddNode(descriptor) }}
      onDragStart={handleDragStart}
    >
      <span className="flex-shrink-0 text-white/40">{icon}</span>
      <span className="text-xs">{label}</span>
    </div>
  )
}

interface CategorySectionProps extends NodeCategory {
  disabled?: boolean
  onAddNode: (entry: NodeDescriptor) => void
}

function CategorySection({ name, nodes, disabled, onAddNode }: CategorySectionProps) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-white/40 hover:text-white/70 transition-colors"
      >
        <ChevronIcon open={open} />
        <span className="text-[11px] font-medium uppercase tracking-wider">{name}</span>
      </button>

      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5 px-1">
          {nodes.map((node) => (
            <NodeItem key={node.label} {...node} disabled={disabled} onAddNode={onAddNode} />
          ))}
        </div>
      )}
    </div>
  )
}

interface NodesSidebarProps {
  triggerDisabled?: boolean
  onAddNode: (entry: NodeDescriptor) => void
}

export function NodesSidebar({ onAddNode, triggerDisabled }: NodesSidebarProps) {
  const [expanded, setExpanded] = useState(true)

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
          {CATEGORIES.map((category) => (
            <CategorySection
              key={category.name}
              {...category}
              disabled={category.name === 'Triggers' ? triggerDisabled : false}
              onAddNode={onAddNode}
            />
          ))}
        </div>
      )}
    </div>
  )
}
