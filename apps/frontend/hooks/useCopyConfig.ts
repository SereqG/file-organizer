'use client'

import { useMemo, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { CopyFileNode, TransferIfExists } from '@/lib/types/workflow'
import { validateCopyConfig } from '@/lib/workflow/validation/validateCopyConfig'

type CopyConfig = CopyFileNode['config']

const EMPTY_CONFIG: CopyConfig = { targetPaths: [], keepOriginal: true, ifExists: 'fail' }

interface UseCopyConfigOptions {
  nodeId: string
  onSave: (config: CopyConfig) => void
  onClose: () => void
}

export function useCopyConfig({ nodeId, onSave, onClose }: UseCopyConfigOptions) {
  const { getNode } = useReactFlow()

  const initial = useMemo<CopyConfig>(() => {
    const node = getNode(nodeId)
    const stored = (node?.data as { config?: CopyConfig } | undefined)?.config
    return stored ?? EMPTY_CONFIG
  }, [getNode, nodeId])

  const [targetPaths, setTargetPaths] = useState<string[]>(initial.targetPaths)
  const [keepOriginal, setKeepOriginal] = useState(initial.keepOriginal)
  const [ifExists, setIfExists] = useState<TransferIfExists>(initial.ifExists)

  const toggleTarget = (path: string) => {
    setTargetPaths((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]))
  }

  const validation = useMemo(() => validateCopyConfig({ targetPaths, keepOriginal, ifExists }), [targetPaths, keepOriginal, ifExists])

  const handleSave = () => {
    if (!validation.valid) return
    onSave({ targetPaths, keepOriginal, ifExists })
    onClose()
  }

  return { targetPaths, toggleTarget, keepOriginal, setKeepOriginal, ifExists, setIfExists, validation, handleSave }
}
