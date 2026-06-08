'use client'

import { useState } from 'react'
import { LuSearch, LuPlus, LuCopy } from 'react-icons/lu'
import type { Category } from '@/lib/types/category'

interface CategoryLibraryPickerProps {
  allCategories: Category[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onCopyPredefined: (id: string) => void
  onCreateNew: () => void
}

export function CategoryLibraryPicker({
  allCategories,
  selectedIds,
  onToggle,
  onCopyPredefined,
  onCreateNew,
}: CategoryLibraryPickerProps) {
  const [query, setQuery] = useState('')

  const filtered = allCategories.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.description.toLowerCase().includes(query.toLowerCase()),
  )

  const predefined = filtered.filter((c) => c.isPredefined)
  const custom = filtered.filter((c) => !c.isPredefined)

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <LuSearch
          size={12}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories..."
          className="w-full rounded-md border border-white/10 bg-white/5 pl-7 pr-3 py-1.5 text-xs text-white/80 placeholder-white/25 focus:border-white/20 focus:outline-none"
        />
      </div>

      <div className="max-h-52 overflow-y-auto flex flex-col gap-1 rounded-md border border-white/10 bg-white/[0.02] p-1.5">
        {filtered.length === 0 && (
          <p className="text-[11px] text-white/30 px-2 py-1.5">No categories match.</p>
        )}

        {predefined.length > 0 && (
          <CategoryGroup
            title="Predefined"
            categories={predefined}
            selectedIds={selectedIds}
            onToggle={onToggle}
            onCopyPredefined={onCopyPredefined}
          />
        )}

        {custom.length > 0 && (
          <CategoryGroup
            title="Custom"
            categories={custom}
            selectedIds={selectedIds}
            onToggle={onToggle}
          />
        )}
      </div>

      <button
        type="button"
        onClick={onCreateNew}
        className="flex items-center gap-1.5 self-start rounded-md border border-purple-500/30 px-2.5 py-1 text-[11px] text-purple-400/80 transition-colors hover:border-purple-500/60 hover:text-purple-300"
      >
        <LuPlus size={11} />
        Create new category
      </button>
    </div>
  )
}

function CategoryGroup({
  title,
  categories,
  selectedIds,
  onToggle,
  onCopyPredefined,
}: {
  title: string
  categories: Category[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onCopyPredefined?: (id: string) => void
}) {
  return (
    <div>
      <div className="px-1 py-0.5 text-[9px] uppercase tracking-wider text-white/25 font-medium">
        {title}
      </div>
      {categories.map((cat) => {
        const selected = selectedIds.includes(cat.id)
        return (
          <div
            key={cat.id}
            className={`flex items-start gap-2 rounded px-1.5 py-1 cursor-pointer transition-colors ${
              selected ? 'bg-purple-500/10' : 'hover:bg-white/5'
            }`}
            onClick={() => onToggle(cat.id)}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle(cat.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 accent-purple-500 flex-shrink-0"
            />
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="text-xs text-white/80 truncate">{cat.name}</span>
              <span className="text-[10px] text-white/40 line-clamp-1">{cat.description}</span>
              <span className="text-[9px] text-white/25 capitalize">
                {cat.itemType} · {cat.minConfidence} confidence
              </span>
            </div>
            {cat.isPredefined && onCopyPredefined && (
              <button
                type="button"
                title="Copy as custom"
                onClick={(e) => {
                  e.stopPropagation()
                  onCopyPredefined(cat.id)
                }}
                className="flex-shrink-0 text-white/30 hover:text-white/60 transition-colors mt-0.5"
              >
                <LuCopy size={10} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
