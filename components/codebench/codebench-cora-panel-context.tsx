"use client"

import { createContext, useContext } from "react"

export type CodebenchCoraPanelContextValue = {
  collapsed: boolean
  toggleCollapse: () => void
}

const CodebenchCoraPanelContext = createContext<CodebenchCoraPanelContextValue | null>(null)

export function CodebenchCoraPanelProvider({
  value,
  children,
}: {
  value: CodebenchCoraPanelContextValue
  children: React.ReactNode
}) {
  return <CodebenchCoraPanelContext.Provider value={value}>{children}</CodebenchCoraPanelContext.Provider>
}

export function useCodebenchCoraPanel() {
  return useContext(CodebenchCoraPanelContext)
}
