'use client'

import { useMemo, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { DeleteFolderNode } from '@/lib/types/workflow'
import { validateDeleteFolderConfig } from '@/lib/workflow/validation/validateDeleteFolderConfig'

const EMPTY_CONFIG: DeleteFolderNode['config'] = {
  deleteAllEncountered: false,
  folderPaths: [],
}

interface UseDeleteFolderConfigOptions {
  nodeId: string
  onSave: (config: DeleteFolderNode['config']) => void
  onClose: () => void
}

export function useDeleteFolderConfig({ nodeId, onSave, onClose }: UseDeleteFolderConfigOptions) {
  const { getNode } = useReactFlow()

  const initial = useMemo<DeleteFolderNode['config']>(() => {
    const node = getNode(nodeId)
    const stored = (node?.data as { config?: DeleteFolderNode['config'] } | undefined)?.config
    return stored ?? EMPTY_CONFIG
  }, [getNode, nodeId])

  const [deleteAllEncountered, setDeleteAllEncountered] = useState(initial.deleteAllEncountered)
  const [folderPaths, setFolderPaths] = useState<string[]>(initial.folderPaths)

  const toggleFolder = (path: string) => {
    setFolderPaths((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]))
  }

  const validation = useMemo(
    () => validateDeleteFolderConfig({ deleteAllEncountered, folderPaths }),
    [deleteAllEncountered, folderPaths]
  )

  const handleSave = () => {
    if (!validation.valid) return
    onSave({ deleteAllEncountered, folderPaths })
    onClose()
  }

  return {
    deleteAllEncountered,
    setDeleteAllEncountered,
    folderPaths,
    toggleFolder,
    validation,
    handleSave,
  }
}
