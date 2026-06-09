'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LuX, LuChevronDown, LuChevronRight } from 'react-icons/lu'
import type { LogEntry, LogEntryKind } from '@/lib/types/workflow'
import { useWorkflowRun } from '@/lib/contexts/WorkflowRunContext'

const MIN_WIDTH = 240
const MAX_WIDTH = 640
const DEFAULT_WIDTH = 320

interface LogsPanelProps {
  onClose: () => void
}

const KIND_COLORS: Record<LogEntryKind, string> = {
  moved: 'text-violet-400',
  copied: 'text-amber-400',
  created: 'text-emerald-400',
  deleted: 'text-red-400',
  renamed: 'text-sky-400',
  skipped: 'text-amber-400',
  warning: 'text-amber-400',
  started: 'text-white/30',
  classified: 'text-purple-400',
  unclassified: 'text-orange-400',
}

function LogRow({ entry }: { entry: LogEntry }) {
  const elapsed = `+${entry.elapsed.toFixed(2)}s`
  const color = KIND_COLORS[entry.kind] ?? 'text-white/50'
  return (
    <div className="flex items-baseline px-3 py-0.5 text-[11px] font-mono">
      <span className="text-white/30 shrink-0 w-[52px]">{elapsed}</span>
      <div className="">
        <span className={`uppercase shrink-0 w-[52px] font-medium ${color}`}>{entry.kind}</span>
        <span className="text-white/70 truncate ml-2" title={entry.itemName}>{entry.itemName}</span>
        {entry.message && (
          <span className="text-white/40 shrink-0">— {entry.message}</span>
        )}
      </div>
    </div>
  )
}

function NodeLogSection({ nodeId, nodeName, entries, isActive }: {
  nodeId: string
  nodeName: string
  entries: LogEntry[]
  isActive: boolean
}) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (isActive) setCollapsed(false)
  }, [isActive])

  const opEntries = entries.filter((e) => e.kind !== 'started')
  const isStartedOnly = opEntries.length === 0

  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-1.5 w-full px-3 py-2 text-left hover:bg-white/5 transition-colors"
      >
        {collapsed
          ? <LuChevronRight size={12} className="text-white/30 shrink-0" />
          : <LuChevronDown size={12} className="text-white/30 shrink-0" />
        }
        <span className={`text-xs font-medium truncate ${isActive ? 'text-white/90' : 'text-white/60'}`}>
          {nodeName}
        </span>
        {isActive && isStartedOnly
          ? <span className="ml-auto text-[10px] text-white/30 shrink-0 animate-pulse">running…</span>
          : <span className="ml-auto text-[10px] text-white/30 shrink-0">{opEntries.length}</span>
        }
      </button>
      {!collapsed && (
        <div className="pb-1">
          {opEntries.map((e, i) => <LogRow key={i} entry={e} />)}
        </div>
      )}
    </div>
  )
}

export function LogsPanel({ onClose }: LogsPanelProps) {
  const { isRunning, currentNodeId, logEntries } = useWorkflowRun()
  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const isDraggingRef = useRef(false)

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return
      const newWidth = window.innerWidth - ev.clientX
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)))
    }

    const onMouseUp = () => {
      isDraggingRef.current = false
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [])

  // Group log entries by node, preserving order of first appearance
  const nodeOrder: string[] = []
  const nodeNames: Record<string, string> = {}
  const entriesByNode: Record<string, LogEntry[]> = {}
  for (const entry of logEntries) {
    if (!entriesByNode[entry.nodeId]) {
      nodeOrder.push(entry.nodeId)
      nodeNames[entry.nodeId] = entry.nodeName
      entriesByNode[entry.nodeId] = []
    }
    entriesByNode[entry.nodeId].push(entry)
  }

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    userScrolledRef.current = !atBottom
  }, [])

  useEffect(() => {
    if (!isRunning || userScrolledRef.current) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logEntries, isRunning])

  return (
    <div
      className="fixed right-0 top-0 h-full z-40 flex flex-col border-l border-white/10 bg-[#0c0c0c]/95 backdrop-blur"
      style={{ width }}
    >
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-white/20 transition-colors"
      />
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <span className="text-sm font-medium text-white/80">Execution Logs</span>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors"
          aria-label="Close logs panel"
        >
          <LuX size={12} />
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {nodeOrder.length === 0 ? (
          <p className="px-4 py-6 text-xs text-white/30">Logs will appear as the workflow runs.</p>
        ) : (
          nodeOrder.map((nodeId) => (
            <NodeLogSection
              key={nodeId}
              nodeId={nodeId}
              nodeName={nodeNames[nodeId]}
              entries={entriesByNode[nodeId]}
              isActive={nodeId === currentNodeId}
            />
          ))
        )}
      </div>
    </div>
  )
}
