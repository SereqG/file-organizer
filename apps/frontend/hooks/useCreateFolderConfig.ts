'use client'

import { useMemo, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { CreateFolderNode, IfExists } from '@/lib/types/workflow'
import type { FileTreeNode } from '@/lib/types/explore'
import { validateCreateFolderConfig } from '@/lib/workflow/validation/validateCreateFolderConfig'
import { findNodeByPath } from '@/components/nodes/create_folder_node/FolderPicker'

const EMPTY_CONFIG: CreateFolderNode['config'] = {
  folderName: '',
  parentFolderPath: '',
  ifExists: 'reuse_existing',
}

interface UseCreateFolderConfigOptions {
  nodeId: string
  workspaceTree: FileTreeNode
  onSave: (config: CreateFolderNode['config']) => void
  onClose: () => void
}

export function useCreateFolderConfig({ nodeId, workspaceTree, onSave, onClose }: UseCreateFolderConfigOptions) {
  const { getNode } = useReactFlow()

  const initial = useMemo<CreateFolderNode['config']>(() => {
    const node = getNode(nodeId)
    const stored = (node?.data as { config?: CreateFolderNode['config'] } | undefined)?.config
    return stored ?? EMPTY_CONFIG
  }, [getNode, nodeId])

  const [folderName, setFolderName] = useState(initial.folderName)
  const [parentFolderPath, setParentFolderPath] = useState(initial.parentFolderPath)
  const [ifExists, setIfExists] = useState<IfExists>(initial.ifExists)

  const selectedParentNode = useMemo(
    () => (parentFolderPath ? findNodeByPath(workspaceTree, parentFolderPath) : null),
    [workspaceTree, parentFolderPath]
  )

  const validation = useMemo(
    () => validateCreateFolderConfig({ folderName, parentFolderPath, ifExists }),
    [folderName, parentFolderPath, ifExists]
  )

  const handleSave = () => {
    if (!validation.valid) return
    onSave({ folderName, parentFolderPath, ifExists })
    onClose()
  }

  return {
    folderName,
    setFolderName,
    parentFolderPath,
    setParentFolderPath,
    ifExists,
    setIfExists,
    selectedParentNode,
    validation,
    handleSave,
  }
}
