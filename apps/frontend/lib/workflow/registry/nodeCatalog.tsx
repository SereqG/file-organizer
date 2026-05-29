import { LuMousePointer2, LuClock, LuGitBranch, LuFolderPlus } from 'react-icons/lu'
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
        icon: <LuMousePointer2 size={14} />,
      },
      {
        kind: 'trigger',
        nodeType: 'trigger',
        triggerId: 'schedule',
        label: 'Schedule',
        icon: <LuClock size={14} />,
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
        icon: <LuGitBranch size={14} />,
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
        icon: <LuFolderPlus size={14} />,
      },
    ],
  },
]
