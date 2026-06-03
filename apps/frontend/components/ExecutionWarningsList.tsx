'use client'

import { LuTriangleAlert } from 'react-icons/lu'
import type { ExecutionWarning } from '@/lib/types/workflow'

// Human-readable labels for the backend warning codes. Unknown codes fall back to the raw code.
const WARNING_LABELS: Record<string, string> = {
  PARENT_INTO_DESCENDANT: 'Skipped: target is inside the source',
  TARGET_IN_SCOPE: 'Skipped: target is itself being moved',
  NO_OP_SAME_LOCATION: 'Skipped: already in the target',
  CROSS_FILESYSTEM: 'Skipped: different filesystem',
  COLLISION_SKIPPED: 'Skipped: name already exists',
  PARTIAL_DIRECTORY: 'Folder handled item-by-item',
}

function groupByCode(warnings: ExecutionWarning[]): Map<string, ExecutionWarning[]> {
  const groups = new Map<string, ExecutionWarning[]>()
  for (const warning of warnings) {
    const bucket = groups.get(warning.code) ?? []
    bucket.push(warning)
    groups.set(warning.code, bucket)
  }
  return groups
}

interface ExecutionWarningsListProps {
  warnings: ExecutionWarning[]
}

export function ExecutionWarningsList({ warnings }: ExecutionWarningsListProps) {
  if (warnings.length === 0) return null

  const groups = [...groupByCode(warnings).entries()]

  return (
    <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
      {groups.map(([code, group]) => (
        <div key={code} className="flex items-start gap-2">
          <LuTriangleAlert size={13} className="mt-0.5 flex-shrink-0 text-amber-400" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-amber-300">
              {WARNING_LABELS[code] ?? code}
              {group.length > 1 && <span className="text-amber-300/60"> ×{group.length}</span>}
            </div>
            <ul className="mt-0.5 space-y-0.5">
              {group.map((warning, index) => (
                <li key={index} className="truncate text-[11px] text-white/50" title={warning.itemPath ?? warning.message}>
                  {warning.itemPath ?? warning.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  )
}
