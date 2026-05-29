'use client'

import { LuPlay, LuSettings2 } from 'react-icons/lu'
import { ControlButton } from './ControlButton'
import type { WorkflowDefinition } from '@/lib/types/workflow'
import { useWorkflowReadiness } from '@/hooks/useWorkflowReadiness'

interface RuntimeControlsProps {
  definition: WorkflowDefinition | null
}

export function RuntimeControls({ definition }: RuntimeControlsProps) {
  const notReadyReason = useWorkflowReadiness(definition)

  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#111] p-1">
      <ControlButton
        label="Run workflow"
        onClick={() => console.log(definition)}
        disabled={notReadyReason !== null}
        disabledReason={notReadyReason ?? undefined}
      >
        <LuPlay size={14} />
      </ControlButton>

      <div className="h-5 w-px bg-white/10" />

      <ControlButton label="Settings" onClick={() => {}}>
        <LuSettings2 size={14} />
      </ControlButton>
    </div>
  )
}
