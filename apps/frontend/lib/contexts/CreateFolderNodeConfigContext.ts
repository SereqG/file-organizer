'use client'

import { createContext, useContext } from 'react'

export interface CreateFolderNodeConfigContextValue {
  openConfig: (nodeId: string) => void
}

export const CreateFolderNodeConfigContext = createContext<CreateFolderNodeConfigContextValue | null>(null)

export function useCreateFolderNodeConfig(): CreateFolderNodeConfigContextValue {
  const ctx = useContext(CreateFolderNodeConfigContext)
  if (!ctx) throw new Error('useCreateFolderNodeConfig must be used within a CreateFolderNodeConfigContext.Provider')
  return ctx
}
