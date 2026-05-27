'use client'

import { useState, useCallback } from 'react'
import type { WorkflowDefinition, WorkflowTriggerNode } from '@/lib/types/workflow'
import type { TriggerId } from '@/components/TriggerSelectModal'

const WORKFLOW_VERSION = '1.0'

function buildTriggerNode(triggerId: TriggerId): WorkflowTriggerNode {
  if (triggerId === 'manual') {
    return {
      id: 'trigger',
      type: 'manual_trigger',
      category: 'trigger',
      name: 'Manual Trigger',
      version: 1,
      config: {},
    }
  }

  return {
    id: 'trigger',
    type: 'schedule_trigger',
    category: 'trigger',
    name: 'Schedule',
    version: 1,
    config: { cron: '', timezone: 'UTC', enabled: false },
  }
}

export function useWorkflowDefinition() {
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null)

  const addTrigger = useCallback((triggerId: TriggerId) => {
    const trigger = buildTriggerNode(triggerId)
    setDefinition({ version: WORKFLOW_VERSION, trigger, nodes: [], edges: [] })
  }, [])

  const removeTrigger = useCallback(() => {
    setDefinition(null)
  }, [])

  return { definition, addTrigger, removeTrigger }
}
