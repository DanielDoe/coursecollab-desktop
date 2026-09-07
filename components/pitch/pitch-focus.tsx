"use client"

import { createContext, useCallback, useContext, useRef, type ReactNode } from "react"

type Handler = (e: KeyboardEvent) => boolean

const PitchFocusContext = createContext<{
  consume: (e: KeyboardEvent) => boolean
  setHandler: (handler: Handler | null) => void
} | null>(null)

export function PitchFocusProvider({ children }: { children: ReactNode }) {
  const ref = useRef<Handler | null>(null)
  const setHandler = useCallback((handler: Handler | null) => {
    ref.current = handler
  }, [])
  const consume = useCallback((e: KeyboardEvent) => ref.current?.(e) ?? false, [])
  return (
    <PitchFocusContext.Provider value={{ consume, setHandler }}>{children}</PitchFocusContext.Provider>
  )
}

export function usePitchFocus() {
  return useContext(PitchFocusContext)
}
