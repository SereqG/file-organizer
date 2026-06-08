'use client'

import { useState } from 'react'
import type { ItemType, MinConfidence } from '@/lib/types/category'
import { CONFIDENCE_LABELS, RESERVED_CATEGORY_NAME } from '@/lib/types/category'
import { Modal } from '@/components/shared/Modal'

interface CreateCategoryModalProps {
  isNameTaken: (name: string) => boolean
  onCreate: (input: {
    name: string
    description: string
    itemType: ItemType
    extensions: string[]
    minConfidence: MinConfidence
  }) => string | null
  onClose: () => void
}

export function CreateCategoryModal({
  isNameTaken,
  onCreate,
  onClose,
}: CreateCategoryModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [itemType, setItemType] = useState<ItemType>('file')
  const [extensionsRaw, setExtensionsRaw] = useState('')
  const [minConfidence, setMinConfidence] = useState<MinConfidence>('medium')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name is required.')
      return
    }
    if (trimmedName.toLowerCase() === RESERVED_CATEGORY_NAME.toLowerCase()) {
      setError('"_unclassified" is a reserved name.')
      return
    }
    if (isNameTaken(trimmedName)) {
      setError(`A category named "${trimmedName}" already exists.`)
      return
    }
    if (!description.trim()) {
      setError('Description is required.')
      return
    }
    if (description.length > 300) {
      setError('Description must be 300 characters or fewer.')
      return
    }

    const extensions = extensionsRaw
      .split(/[\s,]+/)
      .map((e) => (e.startsWith('.') ? e : `.${e}`).toLowerCase())
      .filter((e) => e.length > 1)

    const err = onCreate({
      name: trimmedName,
      description: description.trim(),
      itemType,
      extensions,
      minConfidence,
    })
    if (err) {
      setError(err)
      return
    }
    onClose()
  }

  return (
    <Modal onClose={onClose} ariaLabel="Create category">
      <div className="w-[440px] flex flex-col rounded-xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-medium text-white/80">Create category</span>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-white/40 transition-colors hover:bg-white/10 hover:text-white/80"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M1 1l10 10M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null) }}
              placeholder="e.g. Work Documents"
              maxLength={80}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 placeholder-white/25 focus:border-white/20 focus:outline-none"
            />
          </Field>

          <Field label={`Description (${description.length}/300)`}>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setError(null) }}
              placeholder="Describe what items belong in this category"
              maxLength={300}
              rows={3}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 placeholder-white/25 focus:border-white/20 focus:outline-none resize-none"
            />
          </Field>

          <Field label="Item type">
            <div className="flex gap-2">
              {(['file', 'folder', 'both'] as ItemType[]).map((t) => (
                <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="itemType"
                    value={t}
                    checked={itemType === t}
                    onChange={() => setItemType(t)}
                    className="accent-purple-500"
                  />
                  <span className="text-xs text-white/70 capitalize">{t}</span>
                </label>
              ))}
            </div>
          </Field>

          <Field label="Extensions (optional, space or comma separated)">
            <input
              type="text"
              value={extensionsRaw}
              onChange={(e) => setExtensionsRaw(e.target.value)}
              placeholder=".pdf .docx .txt"
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 placeholder-white/25 focus:border-white/20 focus:outline-none"
            />
          </Field>

          <Field label="Min confidence">
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as MinConfidence[]).map((level) => (
                <label key={level} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="minConfidence"
                    value={level}
                    checked={minConfidence === level}
                    onChange={() => setMinConfidence(level)}
                    className="accent-purple-500"
                  />
                  <span className="text-xs text-white/70">{CONFIDENCE_LABELS[level]}</span>
                </label>
              ))}
            </div>
          </Field>

          {error && (
            <p className="text-[11px] text-rose-400/80">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="rounded-md border border-white/10 bg-transparent px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-white/80"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-md bg-purple-600/80 px-3 py-1.5 text-xs text-white transition-colors hover:bg-purple-600"
          >
            Create
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-white/60">{label}</label>
      {children}
    </div>
  )
}
