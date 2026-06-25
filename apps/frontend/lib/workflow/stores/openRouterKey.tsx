'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

// Accepted, user-owned risk: the OpenRouter key lives in localStorage (readable by client JS) so
// the demo never stores a secret server-side — bring-your-own-key, removable any time. See
// ApiKeyInfoModal. No XSS sink exists today (React auto-escapes; no dangerouslySetInnerHTML).
const KEY_STORAGE = 'file-organizer:openrouter-key'
const ENABLED_STORAGE = 'file-organizer:openrouter-enabled'

export interface OpenRouterKeyContextValue {
  apiKey: string
  isEnabled: boolean
  // True only when the user has both enabled the key and entered a non-empty value. AI nodes are
  // available exactly when this is true.
  isAiAvailable: boolean
  setApiKey: (value: string) => void
  setIsEnabled: (value: boolean) => void
}

const OpenRouterKeyContext = createContext<OpenRouterKeyContextValue | null>(null)

export function OpenRouterKeyProvider({ children }: { children: ReactNode }) {
  // Read from localStorage lazily on first render. The provider only mounts once the user is inside
  // a workspace (client-side), so there is no server render of this subtree to mismatch.
  const [apiKey, setApiKeyState] = useState(() => {
    try { return localStorage.getItem(KEY_STORAGE) ?? '' } catch { return '' }
  })
  const [isEnabled, setIsEnabledState] = useState(() => {
    try { return localStorage.getItem(ENABLED_STORAGE) === 'true' } catch { return false }
  })

  const setApiKey = useCallback((value: string) => {
    setApiKeyState(value)
    try { localStorage.setItem(KEY_STORAGE, value) } catch {}
  }, [])

  const setIsEnabled = useCallback((value: boolean) => {
    setIsEnabledState(value)
    try { localStorage.setItem(ENABLED_STORAGE, String(value)) } catch {}
  }, [])

  const value: OpenRouterKeyContextValue = {
    apiKey,
    isEnabled,
    isAiAvailable: isEnabled && apiKey.trim().length > 0,
    setApiKey,
    setIsEnabled,
  }

  return <OpenRouterKeyContext.Provider value={value}>{children}</OpenRouterKeyContext.Provider>
}

export function useOpenRouterKey(): OpenRouterKeyContextValue {
  const ctx = useContext(OpenRouterKeyContext)
  if (!ctx) throw new Error('useOpenRouterKey must be used within an OpenRouterKeyProvider')
  return ctx
}
