'use client'

import { useMemo, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { MoveFileNode, TransferIfExists } from '@/lib/types/workflow'
import type { FileTreeNode } from '@/lib/types/explore'
import { validateMoveConfig } from '@/lib/workflow/validation/validateMoveConfig'
import { findNodeByPath } from '@/components/nodes/create_folder_node/FolderPicker'

type MoveConfig = MoveFileNode['config']

const EMPTY_CONFIG: MoveConfig = { targetPath: '', ifExists: 'fail' }

interface UseMoveConfigOptions {
  nodeId: string
  workspaceTree: FileTreeNode
  onSave: (config: MoveConfig) => void
  onClose: () => void
}

export function useMoveConfig({ nodeId, workspaceTree, onSave, onClose }: UseMoveConfigOptions) {
  const { getNode } = useReactFlow()

  const initial = useMemo<MoveConfig>(() => {
    const node = getNode(nodeId)
    const stored = (node?.data as { config?: MoveConfig } | undefined)?.config
    return stored ?? EMPTY_CONFIG
  }, [getNode, nodeId])

  const [targetPath, setTargetPath] = useState(initial.targetPath)
  const [ifExists, setIfExists] = useState<TransferIfExists>(initial.ifExists)

  const selectedTargetNode = useMemo(
    () => (targetPath ? findNodeByPath(workspaceTree, targetPath) : null),
    [workspaceTree, targetPath]
  )

  const validation = useMemo(() => validateMoveConfig({ targetPath, ifExists }), [targetPath, ifExists])

  const handleSave = () => {
    if (!validation.valid) return
    onSave({ targetPath, ifExists })
    onClose()
  }

  return { targetPath, setTargetPath, ifExists, setIfExists, selectedTargetNode, validation, handleSave }
}
