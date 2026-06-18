'use client'

import { useState } from 'react'
import { LuRefreshCw, LuInfo } from 'react-icons/lu'
import { useSimulation } from '@/lib/contexts/SimulationContext'
import { DryRunInfoModal } from '@/components/DryRunInfoModal'

export function NodeSimulationBar() {
  const { simLoading, onResimulate } = useSimulation()
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          onClick={onResimulate}
          disabled={simLoading}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Dry run previous nodes"
        >
          <LuRefreshCw size={11} className={simLoading ? 'animate-spin' : ''} />
          Dry run previous nodes
        </button>
        <button
          onClick={() => setInfoOpen(true)}
          className="flex h-5 w-5 items-center justify-center rounded text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/60"
          aria-label="What is dry run?"
        >
          <LuInfo size={12} />
        </button>
      </div>

      {infoOpen && <DryRunInfoModal onClose={() => setInfoOpen(false)} />}
    </>
  )
}
