'use client'

import { useCallback, useState } from 'react'
import type { FileTreeNode } from '@/lib/types/explore'
import { WorkspacePathForm } from './WorkspacePathForm'
import { WorkflowEditor } from './WorkflowEditor'

type WorkspaceState = {
  path: string
  tree: FileTreeNode
  sessionId: string
} | null

export function WorkspaceSection() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(null)

  const handleTreeRefresh = useCallback((tree: FileTreeNode) => {
    setWorkspace(w => w ? { ...w, tree } : w)
  }, [])

  return (
    <>
      {workspace !== null ? (
        <WorkflowEditor
          workspacePath={workspace.path}
          workspaceTree={workspace.tree}
          sessionId={workspace.sessionId}
          onTreeRefresh={handleTreeRefresh}
        />
      ) : (
        <WorkspacePathForm onNextStep={(path, tree, sessionId) => setWorkspace({ path, tree, sessionId })} />
      )}
    </>
  )
}
