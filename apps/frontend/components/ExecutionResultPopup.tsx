'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { LuCircleCheck, LuCircleX, LuX } from 'react-icons/lu'
import type { ExecutionResult } from '@/lib/types/workflow'
import { ExecutionWarningsList } from './ExecutionWarningsList'

interface ExecutionResultPopupProps {
  result: ExecutionResult
  onClose: () => void
}

export function ExecutionResultPopup({ result, onClose }: ExecutionResultPopupProps) {
  const hasWarnings = result.warnings.length > 0

  useEffect(() => {
    // Keep the popup open when there are warnings to read; otherwise auto-dismiss as before.
    if (hasWarnings) return
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose, hasWarnings])

  return createPortal(
    <div
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-start gap-3 rounded-lg border bg-[#111] px-4 py-3 shadow-xl min-w-64 max-w-sm ${result.success ? 'border-emerald-500/30' : 'border-red-500/30'}`}
    >
      {result.success
        ? <LuCircleCheck size={18} className="flex-shrink-0 mt-0.5 text-emerald-400" />
        : <LuCircleX size={18} className="flex-shrink-0 mt-0.5 text-red-400" />
      }
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
          {result.success ? 'Workflow completed' : 'Workflow failed'}
        </div>
        {result.error && (
          <div className="mt-0.5 text-xs text-white/60 break-words">{result.error}</div>
        )}
        <ExecutionWarningsList warnings={result.warnings} />
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 text-white/40 hover:text-white/70 transition-colors"
        aria-label="Close"
      >
        <LuX size={14} />
      </button>
    </div>,
    document.body
  )
}
