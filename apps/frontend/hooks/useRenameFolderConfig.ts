'use client'

import { useMemo, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { RenameFolderNode, RenameIfExists } from '@/lib/types/workflow'
import type { FileTreeNode } from '@/lib/types/explore'
import { validateRenameFolderConfig } from '@/lib/workflow/validation/validateRenameFolderConfig'
import { findNodeByPath } from '@/components/nodes/create_folder_node/FolderPicker'

const EMPTY_CONFIG: RenameFolderNode['config'] = {
  folderPath: '',
  newName: '',
  ifExists: 'fail',
}

interface UseRenameFolderConfigOptions {
  nodeId: string
  workspaceTree: FileTreeNode
  onSave: (config: RenameFolderNode['config']) => void
  onClose: () => void
}

export function useRenameFolderConfig({ nodeId, workspaceTree, onSave, onClose }: UseRenameFolderConfigOptions) {
  const { getNode } = useReactFlow()

  const initial = useMemo<RenameFolderNode['config']>(() => {
    const node = getNode(nodeId)
    const stored = (node?.data as { config?: RenameFolderNode['config'] } | undefined)?.config
    return stored ?? EMPTY_CONFIG
  }, [getNode, nodeId])

  const [folderPath, setFolderPath] = useState(initial.folderPath)
  const [newName, setNewName] = useState(initial.newName)
  const [ifExists, setIfExists] = useState<RenameIfExists>(initial.ifExists)

  const selectedNode = useMemo(
    () => (folderPath ? findNodeByPath(workspaceTree, folderPath) : null),
    [workspaceTree, folderPath]
  )

  const validation = useMemo(
    () => validateRenameFolderConfig({ folderPath, newName, ifExists }),
    [folderPath, newName, ifExists]
  )

  const handleSave = () => {
    if (!validation.valid) return
    onSave({ folderPath, newName, ifExists })
    onClose()
  }

  return {
    folderPath,
    setFolderPath,
    newName,
    setNewName,
    ifExists,
    setIfExists,
    selectedNode,
    validation,
    handleSave,
  }
}
