'use client'

import type { ExecutionFailedNode, WorkflowDefinition } from '@/lib/types/workflow'
import { ViewportControls } from './ViewportControls'
import { RuntimeControls } from './RuntimeControls'

interface BottomControlsProps {
  definition: WorkflowDefinition | null
  rootPath: string
  onRunStart: () => void
  onRunComplete: (failedNodes: ExecutionFailedNode[]) => void
}

export function BottomControls({ definition, rootPath, onRunStart, onRunComplete }: BottomControlsProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
      <ViewportControls />
      <RuntimeControls
        definition={definition}
        rootPath={rootPath}
        onRunStart={onRunStart}
        onRunComplete={onRunComplete}
      />
    </div>
  )
}
