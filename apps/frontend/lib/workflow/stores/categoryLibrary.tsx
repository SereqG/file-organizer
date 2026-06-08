'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Category, MinConfidence, ItemType } from '@/lib/types/category'
import { RESERVED_CATEGORY_NAME } from '@/lib/types/category'

const STORAGE_KEY = 'file-organizer:category-library'

export const PREDEFINED_CATEGORIES: Category[] = [
  {
    id: 'predefined:documents',
    name: 'Documents',
    description: 'Looks like an official document, report, letter, or contract',
    itemType: 'file',
    extensions: ['.pdf', '.doc', '.docx', '.txt', '.odt'],
    minConfidence: 'medium',
    isPredefined: true,
  },
  {
    id: 'predefined:images',
    name: 'Images',
    description: 'An image or photo file',
    itemType: 'file',
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'],
    minConfidence: 'low',
    isPredefined: true,
  },
  {
    id: 'predefined:videos',
    name: 'Videos',
    description: 'A video recording or clip',
    itemType: 'file',
    extensions: ['.mp4', '.avi', '.mov', '.mkv', '.wmv'],
    minConfidence: 'low',
    isPredefined: true,
  },
  {
    id: 'predefined:audio',
    name: 'Audio',
    description: 'An audio recording or music file',
    itemType: 'file',
    extensions: ['.mp3', '.wav', '.flac', '.aac', '.ogg'],
    minConfidence: 'low',
    isPredefined: true,
  },
  {
    id: 'predefined:archives',
    name: 'Archives',
    description: 'A compressed archive or bundle',
    itemType: 'file',
    extensions: ['.zip', '.tar', '.gz', '.rar', '.7z'],
    minConfidence: 'low',
    isPredefined: true,
  },
  {
    id: 'predefined:code',
    name: 'Code',
    description: 'Source code or a programming file',
    itemType: 'file',
    extensions: ['.js', '.ts', '.py', '.java', '.go', '.rb', '.css', '.html'],
    minConfidence: 'medium',
    isPredefined: true,
  },
  {
    id: 'predefined:spreadsheets',
    name: 'Spreadsheets',
    description: 'A table, spreadsheet, or structured data file',
    itemType: 'file',
    extensions: ['.xlsx', '.xls', '.csv', '.ods'],
    minConfidence: 'medium',
    isPredefined: true,
  },
  {
    id: 'predefined:invoices',
    name: 'Invoices',
    description: 'A financial invoice, bill, or receipt',
    itemType: 'file',
    extensions: ['.pdf', '.doc', '.docx'],
    minConfidence: 'high',
    isPredefined: true,
  },
]

export function loadCustomCategories(): Category[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Category[]
  } catch {
    return []
  }
}

function saveCustomCategories(categories: Category[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))
  } catch {
    // localStorage full or unavailable
  }
}

export interface CategoryLibraryContextValue {
  allCategories: Category[]
  predefinedCategories: Category[]
  customCategories: Category[]
  loaded: boolean
  getCategoryById: (id: string) => Category | undefined
  isNameTaken: (name: string, excludeId?: string) => boolean
  createCategory: (input: {
    name: string
    description: string
    itemType: ItemType
    extensions: string[]
    minConfidence: MinConfidence
  }) => string | null
  updateCategory: (id: string, input: Partial<Omit<Category, 'id' | 'isPredefined'>>) => string | null
  deleteCategory: (id: string) => void
  copyPredefined: (id: string) => string | null
}

const CategoryLibraryContext = createContext<CategoryLibraryContextValue | null>(null)

export function CategoryLibraryProvider({ children }: { children: ReactNode }) {
  const [customCategories, setCustomCategories] = useState<Category[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setCustomCategories(loadCustomCategories())
    setLoaded(true)
  }, [])

  const allCategories = [...PREDEFINED_CATEGORIES, ...customCategories]

  const getCategoryById = useCallback(
    (id: string): Category | undefined => allCategories.find((c) => c.id === id),
    [allCategories],
  )

  const isNameTaken = useCallback(
    (name: string, excludeId?: string): boolean =>
      allCategories.some(
        (c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== excludeId,
      ),
    [allCategories],
  )

  const createCategory = useCallback(
    (input: {
      name: string
      description: string
      itemType: ItemType
      extensions: string[]
      minConfidence: MinConfidence
    }): string | null => {
      if (input.name.toLowerCase() === RESERVED_CATEGORY_NAME.toLowerCase()) {
        return 'Name "_unclassified" is reserved.'
      }
      if (isNameTaken(input.name)) {
        return `A category named "${input.name}" already exists.`
      }
      const id = `custom:${Date.now()}-${Math.random().toString(36).slice(2)}`
      const newCategory: Category = { ...input, id, isPredefined: false }
      setCustomCategories((prev) => {
        const updated = [...prev, newCategory]
        saveCustomCategories(updated)
        return updated
      })
      return null
    },
    [isNameTaken],
  )

  const updateCategory = useCallback(
    (
      id: string,
      input: Partial<Omit<Category, 'id' | 'isPredefined'>>,
    ): string | null => {
      if (input.name) {
        if (input.name.toLowerCase() === RESERVED_CATEGORY_NAME.toLowerCase()) {
          return 'Name "_unclassified" is reserved.'
        }
        if (isNameTaken(input.name, id)) {
          return `A category named "${input.name}" already exists.`
        }
      }
      setCustomCategories((prev) => {
        const updated = prev.map((c) => (c.id === id ? { ...c, ...input } : c))
        saveCustomCategories(updated)
        return updated
      })
      return null
    },
    [isNameTaken],
  )

  const deleteCategory = useCallback((id: string): void => {
    setCustomCategories((prev) => {
      const updated = prev.filter((c) => c.id !== id)
      saveCustomCategories(updated)
      return updated
    })
  }, [])

  const copyPredefined = useCallback(
    (id: string): string | null => {
      const source = PREDEFINED_CATEGORIES.find((c) => c.id === id)
      if (!source) return 'Category not found.'
      let name = `${source.name} (copy)`
      let counter = 2
      while (isNameTaken(name)) {
        name = `${source.name} (copy ${counter++})`
      }
      return createCategory({
        name,
        description: source.description,
        itemType: source.itemType,
        extensions: [...source.extensions],
        minConfidence: source.minConfidence,
      })
    },
    [isNameTaken, createCategory],
  )

  const value: CategoryLibraryContextValue = {
    allCategories,
    predefinedCategories: PREDEFINED_CATEGORIES,
    customCategories,
    loaded,
    getCategoryById,
    isNameTaken,
    createCategory,
    updateCategory,
    deleteCategory,
    copyPredefined,
  }

  return <CategoryLibraryContext.Provider value={value}>{children}</CategoryLibraryContext.Provider>
}

export function useCategoryLibrary(): CategoryLibraryContextValue {
  const ctx = useContext(CategoryLibraryContext)
  if (!ctx) throw new Error('useCategoryLibrary must be used within a CategoryLibraryProvider')
  return ctx
}
