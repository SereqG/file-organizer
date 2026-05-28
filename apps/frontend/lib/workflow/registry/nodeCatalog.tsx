import type { NodeKind } from '@/lib/types/workflowNodeDescriptor'
import type React from 'react'

export interface NodeEntry {
  kind: NodeKind
  nodeType: string
  triggerId?: string
  label: string
  icon: React.ReactNode
}

export interface NodeCategory {
  name: string
  nodes: NodeEntry[]
}

export const NODE_CATEGORIES: NodeCategory[] = [
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
            <path d="M4.5 2.5V8L6 6.5H10L4.5 2.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
            <path d="M6 6.5L8 11" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
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
  {
    name: 'Create',
    nodes: [
      {
        kind: 'create',
        nodeType: 'createFolder',
        label: 'Create Folder',
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.5 3.5C1.5 3.5 3 3.5 4 3.5L5.5 2H12.5V10.5H1.5V3.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
            <path d="M7 5.5V8.5M5.5 7H8.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
]
