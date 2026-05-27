'use client'

import { useReactFlow } from '@xyflow/react'
import { ControlButton } from './ControlButton'

export function ViewportControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-lg border border-white/10 bg-[#111] p-1">
      <ControlButton label="Zoom out" onClick={() => zoomOut()}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </ControlButton>

      <div className="h-5 w-px bg-white/10" />

      <ControlButton label="Reset view" onClick={() => fitView({ duration: 300 })}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1.75" y="1.75" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.25"/>
          <rect x="8.25" y="1.75" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.25"/>
          <rect x="1.75" y="8.25" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.25"/>
          <rect x="8.25" y="8.25" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.25"/>
        </svg>
      </ControlButton>

      <div className="h-5 w-px bg-white/10" />

      <ControlButton label="Zoom in" onClick={() => zoomIn()}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </ControlButton>
    </div>
  )
}
