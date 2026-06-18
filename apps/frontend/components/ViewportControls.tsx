'use client'

import { useReactFlow, useViewport, useStore } from '@xyflow/react'
import { LuMinus, LuLayoutGrid, LuPlus } from 'react-icons/lu'
import { ControlButton } from './ControlButton'

export function ViewportControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const { zoom } = useViewport()
  const minZoom = useStore((s) => s.minZoom)
  const maxZoom = useStore((s) => s.maxZoom)

  const atMin = zoom <= minZoom
  const atMax = zoom >= maxZoom

  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#111] p-1">
      <ControlButton label="Zoom out" onClick={() => zoomOut()} disabled={atMin}>
        <LuMinus size={14} />
      </ControlButton>

      <div className="h-5 w-px bg-white/10" />

      <ControlButton label="Reset view" onClick={() => fitView({ duration: 300 })}>
        <LuLayoutGrid size={14} />
      </ControlButton>

      <div className="h-5 w-px bg-white/10" />

      <ControlButton label="Zoom in" onClick={() => zoomIn()} disabled={atMax}>
        <LuPlus size={14} />
      </ControlButton>
    </div>
  )
}
