'use client'

import { useMemo, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { CreateFolderNode, IfExists } from '@/lib/types/workflow'
import type { FileTreeNode } from '@/lib/types/explore'
import { validateCreateFolderConfig } from '@/lib/workflow/validation/validateCreateFolderConfig'
import { findNodeById } from '@/components/nodes/create_folder_node/FolderPicker'

const EMPTY_CONFIG: CreateFolderNode['config'] = {
  folderName: '',
  parentFolderId: '',
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
  const [parentFolderId, setParentFolderId] = useState(initial.parentFolderId)
  const [ifExists, setIfExists] = useState<IfExists>(initial.ifExists)

  const selectedParentNode = useMemo(
    () => (parentFolderId ? findNodeById(workspaceTree, parentFolderId) : null),
    [workspaceTree, parentFolderId]
  )

  const validation = useMemo(
    () => validateCreateFolderConfig({ folderName, parentFolderId, ifExists }),
    [folderName, parentFolderId, ifExists]
  )

  const handleSave = () => {
    if (!validation.valid) return
    onSave({ folderName, parentFolderId, ifExists })
    onClose()
  }

  return {
    folderName,
    setFolderName,
    parentFolderId,
    setParentFolderId,
    ifExists,
    setIfExists,
    selectedParentNode,
    validation,
    handleSave,
  }
}
