'use client'

import { createContext, useContext } from 'react'

export interface SimulationContextValue {
  simLoading: boolean
  onResimulate: () => void
}

export const SimulationContext = createContext<SimulationContextValue>({
  simLoading: false,
  onResimulate: () => {},
})

export function useSimulation() {
  return useContext(SimulationContext)
}
