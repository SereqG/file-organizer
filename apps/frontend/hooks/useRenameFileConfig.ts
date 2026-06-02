'use client'

import { useMemo, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { RenameFileNode, RenameIfExists } from '@/lib/types/workflow'
import type { FileTreeNode } from '@/lib/types/explore'
import { validateRenameFileConfig } from '@/lib/workflow/validation/validateRenameFileConfig'
import { findNodeByPath } from '@/components/nodes/create_folder_node/FolderPicker'

const EMPTY_CONFIG: RenameFileNode['config'] = {
  filePath: '',
  newName: '',
  ifExists: 'fail',
}

// Mirrors Python's Path.suffix: the trailing ".ext" (last dot, not the leading one), or '' when the
// file has no extension. The backend re-attaches exactly this, so the UI must display the same.
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot) : ''
}

interface UseRenameFileConfigOptions {
  nodeId: string
  workspaceTree: FileTreeNode
  onSave: (config: RenameFileNode['config']) => void
  onClose: () => void
}

export function useRenameFileConfig({ nodeId, workspaceTree, onSave, onClose }: UseRenameFileConfigOptions) {
  const { getNode } = useReactFlow()

  const initial = useMemo<RenameFileNode['config']>(() => {
    const node = getNode(nodeId)
    const stored = (node?.data as { config?: RenameFileNode['config'] } | undefined)?.config
    return stored ?? EMPTY_CONFIG
  }, [getNode, nodeId])

  const [filePath, setFilePath] = useState(initial.filePath)
  const [newName, setNewName] = useState(initial.newName)
  const [ifExists, setIfExists] = useState<RenameIfExists>(initial.ifExists)

  const selectedNode = useMemo(
    () => (filePath ? findNodeByPath(workspaceTree, filePath) : null),
    [workspaceTree, filePath]
  )

  const extension = selectedNode ? fileExtension(selectedNode.name) : ''

  const validation = useMemo(
    () => validateRenameFileConfig({ filePath, newName, ifExists }),
    [filePath, newName, ifExists]
  )

  const handleSave = () => {
    if (!validation.valid) return
    onSave({ filePath, newName, ifExists })
    onClose()
  }

  return {
    filePath,
    setFilePath,
    newName,
    setNewName,
    ifExists,
    setIfExists,
    selectedNode,
    extension,
    validation,
    handleSave,
  }
}
