"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import type { CoraProblemContext } from "@/lib/cora/types"
import { CoraWorkspace } from "@/components/cora/CoraWorkspace"

type CoraContextValue = {
  open: boolean
  problem: CoraProblemContext | null
  openCora: (problem: CoraProblemContext) => void
  closeCora: () => void
}

const CoraContext = createContext<CoraContextValue | null>(null)

export function CoraProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [problem, setProblem] = useState<CoraProblemContext | null>(null)

  const openCora = useCallback((ctx: CoraProblemContext) => {
    setProblem(ctx)
    setOpen(true)
  }, [])

  const closeCora = useCallback(() => {
    setOpen(false)
  }, [])

  const value = useMemo(
    () => ({ open, problem, openCora, closeCora }),
    [open, problem, openCora, closeCora],
  )

  return (
    <CoraContext.Provider value={value}>
      {children}
      <CoraWorkspace open={open} problem={problem} onClose={closeCora} />
    </CoraContext.Provider>
  )
}

export function useCora() {
  const ctx = useContext(CoraContext)
  if (!ctx) {
    throw new Error("useCora must be used within CoraProvider")
  }
  return ctx
}

export function useCoraOptional() {
  return useContext(CoraContext)
}
