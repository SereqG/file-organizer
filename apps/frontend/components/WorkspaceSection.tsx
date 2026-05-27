'use client'

import { useState } from 'react'
import type { FileTreeNode } from '@/lib/types/explore'
import { WorkspacePathForm } from './WorkspacePathForm'
import { WorkflowEditor } from './WorkflowEditor'

type WorkspaceState = {
  path: string
  tree: FileTreeNode
} | null

export function WorkspaceSection() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(null)

  return (
    <>
      {workspace !== null ? (
        <WorkflowEditor workspacePath={workspace.path} workspaceTree={workspace.tree} />
      ) : (
        <WorkspacePathForm onNextStep={(path, tree) => setWorkspace({ path, tree })} />
      )}
    </>
  )
}
