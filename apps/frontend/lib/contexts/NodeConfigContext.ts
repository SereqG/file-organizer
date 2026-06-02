'use client'

import { createContext, useContext } from 'react'

export interface NodeConfigContextValue {
  openIfNodeConfig: (nodeId: string) => void
  openSwitchNodeConfig: (nodeId: string) => void
  openCreateFolderNodeConfig: (nodeId: string) => void
  openDeleteFolderNodeConfig: (nodeId: string) => void
  openRenameFolderNodeConfig: (nodeId: string) => void
}

export const NodeConfigContext = createContext<NodeConfigContextValue | null>(null)

export function useNodeConfig(): NodeConfigContextValue {
  const ctx = useContext(NodeConfigContext)
  if (!ctx) throw new Error('useNodeConfig must be used within a NodeConfigContext.Provider')
  return ctx
}
