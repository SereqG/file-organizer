'use client'

import type { WorkflowDefinition } from '@/lib/types/workflow'
import { ViewportControls } from './ViewportControls'
import { RuntimeControls } from './RuntimeControls'

interface BottomControlsProps {
  definition: WorkflowDefinition | null
}

export function BottomControls({ definition }: BottomControlsProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
      <ViewportControls />
      <RuntimeControls definition={definition} />
    </div>
  )
}
