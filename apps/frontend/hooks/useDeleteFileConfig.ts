'use client'

import { useMemo, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { DeleteFileNode } from '@/lib/types/workflow'
import { validateDeleteFileConfig } from '@/lib/workflow/validation/validateDeleteFileConfig'

const EMPTY_CONFIG: DeleteFileNode['config'] = {
  deleteAllEncountered: false,
  filePaths: [],
}

interface UseDeleteFileConfigOptions {
  nodeId: string
  onSave: (config: DeleteFileNode['config']) => void
  onClose: () => void
}

export function useDeleteFileConfig({ nodeId, onSave, onClose }: UseDeleteFileConfigOptions) {
  const { getNode } = useReactFlow()

  const initial = useMemo<DeleteFileNode['config']>(() => {
    const node = getNode(nodeId)
    const stored = (node?.data as { config?: DeleteFileNode['config'] } | undefined)?.config
    return stored ?? EMPTY_CONFIG
  }, [getNode, nodeId])

  const [deleteAllEncountered, setDeleteAllEncountered] = useState(initial.deleteAllEncountered)
  const [filePaths, setFilePaths] = useState<string[]>(initial.filePaths)

  const toggleFile = (path: string) => {
    setFilePaths((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]))
  }

  const validation = useMemo(
    () => validateDeleteFileConfig({ deleteAllEncountered, filePaths }),
    [deleteAllEncountered, filePaths]
  )

  const handleSave = () => {
    if (!validation.valid) return
    onSave({ deleteAllEncountered, filePaths })
    onClose()
  }

  return {
    deleteAllEncountered,
    setDeleteAllEncountered,
    filePaths,
    toggleFile,
    validation,
    handleSave,
  }
}
