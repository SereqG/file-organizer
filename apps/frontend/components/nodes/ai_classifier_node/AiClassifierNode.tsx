'use client'

import { Fragment, useCallback } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { AiClassifierNode as AiClassifierNodeType } from '@/lib/types/workflow'
import { AI_CLASSIFIER_UNCLASSIFIED_HANDLE } from '@/lib/types/workflow'
import { aiClassifierOutputColor, AI_CLASSIFIER_UNCLASSIFIED_COLOR } from '@/lib/workflow/utils/aiClassifierColors'
import { useCategoryLibrary } from '@/lib/workflow/stores/categoryLibrary'
import { useNodeConfig } from '@/lib/contexts/NodeConfigContext'
import { useWorkflowRun } from '@/lib/contexts/WorkflowRunContext'
import { LuTrash2, LuTags, LuLoaderCircle } from 'react-icons/lu'

export interface AiClassifierNodeData extends Record<string, unknown> {
  label: string
  config?: AiClassifierNodeType['config']
  executionError?: string
}

export type AiClassifierRFNode = Node<AiClassifierNodeData, 'ai_classifier'>

const HEADER_HEIGHT = 56
const OUTPUT_SLOT = 22

interface OutputHandle {
  id: string
  label: string
  color: string
}

function buildOutputs(
  categoryIds: string[],
  getCategoryById: (id: string) => { name: string } | undefined,
): OutputHandle[] {
  const outputs: OutputHandle[] = categoryIds.map((id, index) => ({
    id,
    label: getCategoryById(id)?.name ?? id.slice(0, 10),
    color: aiClassifierOutputColor(index),
  }))
  outputs.push({ id: AI_CLASSIFIER_UNCLASSIFIED_HANDLE, label: 'unclassified', color: AI_CLASSIFIER_UNCLASSIFIED_COLOR })
  return outputs
}

export function AiClassifierNode({ id, data }: NodeProps<AiClassifierRFNode>) {
  const { deleteElements } = useReactFlow()
  const { openAiClassifierNodeConfig } = useNodeConfig()
  const { getCategoryById } = useCategoryLibrary()
  const { currentNodeId } = useWorkflowRun()

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      deleteElements({ nodes: [{ id }] })
    },
    [id, deleteElements],
  )

  const handleOpen = useCallback(
    () => openAiClassifierNodeConfig(id),
    [id, openAiClassifierNodeConfig],
  )

  const categoryIds = data.config?.categoryIds ?? []
  const outputs = buildOutputs(categoryIds, getCategoryById)
  const configured = categoryIds.length > 0
  const hasError = !!data.executionError
  const isActive = currentNodeId === id

  return (
    <div
      onClick={handleOpen}
      className="relative cursor-pointer"
      style={{
        padding: 1.5,
        borderRadius: 10,
        minHeight: HEADER_HEIGHT + outputs.length * OUTPUT_SLOT,
      }}
    >
      {/* Gradient border layer */}
      <div
        className="absolute inset-0 rounded-[10px]"
        style={{
          background: hasError
            ? 'linear-gradient(135deg, #ef4444, #f97316)'
            : 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)',
          opacity: 0.7,
        }}
      />

      {/* Inner card */}
      <div
        className="relative flex items-center gap-2.5 rounded-[8px] bg-[#111] px-3 py-2.5 pr-8 shadow-lg min-w-44"
        style={{ minHeight: HEADER_HEIGHT + outputs.length * OUTPUT_SLOT - 3 }}
      >
        {/* AI star badge */}
        <div className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-[8px] font-bold shadow">
          ✦
        </div>

        {isActive && (
          <div className="absolute top-1.5 left-1.5">
            <LuLoaderCircle size={12} className="animate-spin text-white/60" />
          </div>
        )}

        <button
          onClick={handleDelete}
          className="absolute -top-2.5 -right-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-red-500/60 bg-[#111] text-red-500/80 transition-colors hover:border-red-500 hover:bg-red-500/10 hover:text-red-400"
          aria-label="Delete node"
          style={{ top: -10, right: -10 }}
        >
          <LuTrash2 size={10} />
        </button>

        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-purple-500/30 text-purple-300">
          <LuTags size={16} />
        </span>
        <div className="flex flex-col gap-0.5">
          <div className="text-[10px] uppercase tracking-wider text-purple-400/70 font-medium">
            AI Classifier
          </div>
          <div className="text-xs text-white/80">{data.label}</div>
          <div
            className={`text-[9px] uppercase tracking-wider ${
              configured ? 'text-emerald-400/70' : 'text-rose-400/70'
            }`}
          >
            {configured
              ? `${categoryIds.length} categor${categoryIds.length === 1 ? 'y' : 'ies'}`
              : 'Not configured'}
          </div>
          {hasError && (
            <div
              className="text-[9px] text-red-400/80 max-w-[140px] truncate"
              title={data.executionError}
            >
              {data.executionError}
            </div>
          )}
        </div>

        <Handle
          type="target"
          position={Position.Left}
          className="!border-white/50 !bg-white/30"
        />

        {outputs.map((output, index) => {
          const top = `${((index + 1) / (outputs.length + 1)) * 100}%`
          return (
            <Fragment key={output.id}>
              <Handle
                type="source"
                id={output.id}
                position={Position.Right}
                style={{ top, borderColor: output.color, backgroundColor: output.color }}
              />
              <span
                className="pointer-events-none absolute right-2 text-[9px] font-medium tracking-wide truncate max-w-[80px]"
                style={{ top: `calc(${top} - 7px)`, color: output.color }}
              >
                {output.label}
              </span>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
