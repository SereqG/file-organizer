'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ReactFlow, Background, BackgroundVariant } from '@xyflow/react'
import type { FileTreeNode } from '@/lib/types/explore'
import { WorkspaceIndicator } from './WorkspaceIndicator'
import { ViewportControls } from './ViewportControls'

interface WorkflowEditorProps {
  workspacePath: string
  workspaceTree: FileTreeNode
}

export function WorkflowEditor({ workspacePath, workspaceTree }: WorkflowEditorProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0">
      <WorkspaceIndicator path={workspacePath} tree={workspaceTree} />
      <ReactFlow className="w-full h-full" nodes={[]} edges={[]} nodesDraggable={false} nodesConnectable={false} defaultViewport={{ x: 0, y: 0, zoom: 1 }}>
        <Background
          variant={BackgroundVariant.Dots}
          gap={32}
          size={1.5}
          color="rgba(255, 255, 255, 0.4)"
          bgColor="#080808"
        />
        <ViewportControls />
      </ReactFlow>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 60% 30% at 50% 0%,   rgba(249,115,22,0.18) 0%, transparent 100%)',
            'radial-gradient(ellipse 60% 30% at 50% 100%, rgba(249,115,22,0.18) 0%, transparent 100%)',
            'radial-gradient(ellipse 30% 60% at 0%   50%, rgba(249,115,22,0.14) 0%, transparent 100%)',
            'radial-gradient(ellipse 30% 60% at 100% 50%, rgba(249,115,22,0.14) 0%, transparent 100%)',
          ].join(', '),
        }}
      />
    </div>,
    document.body
  )
}
