'use client'

import { useMemo, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { AiClassifierNode } from '@/lib/types/workflow'
import { validateAiClassifierConfig } from '@/lib/workflow/validation/validateAiClassifierConfig'

type AiClassifierConfig = AiClassifierNode['config']

const EMPTY_CONFIG: AiClassifierConfig = {
  categoryIds: [],
  allowDuplicate: false,
}

interface UseAiClassifierConfigOptions {
  nodeId: string
  onSave: (config: AiClassifierConfig) => void
  onClose: () => void
}

export function useAiClassifierConfig({
  nodeId,
  onSave,
  onClose,
}: UseAiClassifierConfigOptions) {
  const { getNode } = useReactFlow()

  const initial = useMemo<AiClassifierConfig>(() => {
    const node = getNode(nodeId)
    const stored = (node?.data as { config?: AiClassifierConfig } | undefined)?.config
    return stored ?? EMPTY_CONFIG
  }, [getNode, nodeId])

  const [categoryIds, setCategoryIds] = useState<string[]>(initial.categoryIds)
  const [allowDuplicate, setAllowDuplicate] = useState(initial.allowDuplicate)

  const toggleCategory = (id: string) => {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  const moveCategoryUp = (id: string) => {
    setCategoryIds((prev) => {
      const i = prev.indexOf(id)
      if (i <= 0) return prev
      const next = [...prev]
      ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
      return next
    })
  }

  const moveCategoryDown = (id: string) => {
    setCategoryIds((prev) => {
      const i = prev.indexOf(id)
      if (i < 0 || i >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
      return next
    })
  }

  const removeCategory = (id: string) => {
    setCategoryIds((prev) => prev.filter((c) => c !== id))
  }

  const validation = useMemo(
    () => validateAiClassifierConfig({ categoryIds, allowDuplicate }),
    [categoryIds, allowDuplicate],
  )

  const handleSave = () => {
    if (!validation.valid) return
    onSave({ categoryIds, allowDuplicate })
    onClose()
  }

  return {
    categoryIds,
    toggleCategory,
    moveCategoryUp,
    moveCategoryDown,
    removeCategory,
    allowDuplicate,
    setAllowDuplicate,
    validation,
    handleSave,
  }
}
