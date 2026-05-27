'use client'

import { createContext, useContext } from 'react'

export interface IfNodeConfigContextValue {
  openConfig: (nodeId: string) => void
}

export const IfNodeConfigContext = createContext<IfNodeConfigContextValue | null>(null)

export function useIfNodeConfig(): IfNodeConfigContextValue {
  const ctx = useContext(IfNodeConfigContext)
  if (!ctx) throw new Error('useIfNodeConfig must be used within an IfNodeConfigContext.Provider')
  return ctx
}
