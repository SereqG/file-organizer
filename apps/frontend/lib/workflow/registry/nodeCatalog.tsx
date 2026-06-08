import { LuMousePointer2, LuClock, LuGitBranch, LuSplit, LuFolderPlus, LuFolderX, LuFolderPen, LuFileX, LuFilePen, LuFolderInput, LuFileInput, LuCopy, LuCopyPlus, LuTags } from 'react-icons/lu'
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
      {
        kind: 'general',
        nodeType: 'switch',
        label: 'Switch',
        icon: <LuSplit size={14} />,
      },
    ],
  },
  {
    name: 'Folders',
    nodes: [
      {
        kind: 'create',
        nodeType: 'createFolder',
        label: 'Create Folder',
        icon: <LuFolderPlus size={14} />,
      },
      {
        kind: 'create',
        nodeType: 'deleteFolder',
        label: 'Delete Folder',
        icon: <LuFolderX size={14} />,
      },
      {
        kind: 'create',
        nodeType: 'renameFolder',
        label: 'Rename Folder',
        icon: <LuFolderPen size={14} />,
      },
    ],
  },
  {
    name: 'Files',
    nodes: [
      {
        kind: 'create',
        nodeType: 'deleteFile',
        label: 'Delete File',
        icon: <LuFileX size={14} />,
      },
      {
        kind: 'create',
        nodeType: 'renameFile',
        label: 'Rename File',
        icon: <LuFilePen size={14} />,
      },
    ],
  },
  {
    name: 'Transfer',
    nodes: [
      {
        kind: 'create',
        nodeType: 'moveFolder',
        label: 'Move Folder',
        icon: <LuFolderInput size={14} />,
      },
      {
        kind: 'create',
        nodeType: 'moveFile',
        label: 'Move File',
        icon: <LuFileInput size={14} />,
      },
      {
        kind: 'create',
        nodeType: 'copyFolder',
        label: 'Copy Folder',
        icon: <LuCopy size={14} />,
      },
      {
        kind: 'create',
        nodeType: 'copyFile',
        label: 'Copy File',
        icon: <LuCopyPlus size={14} />,
      },
    ],
  },
  {
    name: 'AI Nodes',
    nodes: [
      {
        kind: 'create',
        nodeType: 'ai_classifier',
        label: 'AI Classifier',
        icon: <LuTags size={14} />,
      },
    ],
  },
]
