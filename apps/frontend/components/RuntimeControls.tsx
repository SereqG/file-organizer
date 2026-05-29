'use client'

import { LuPlay, LuSettings2 } from 'react-icons/lu'
import { ControlButton } from './ControlButton'
import type { WorkflowDefinition } from '@/lib/types/workflow'

interface RuntimeControlsProps {
  definition: WorkflowDefinition | null
}

export function RuntimeControls({ definition }: RuntimeControlsProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#111] p-1">
      <ControlButton label="Run workflow" onClick={() => console.log(definition)}>
        <LuPlay size={14} />
      </ControlButton>

      <div className="h-5 w-px bg-white/10" />

      <ControlButton label="Settings" onClick={() => {}}>
        <LuSettings2 size={14} />
      </ControlButton>
    </div>
  )
}
