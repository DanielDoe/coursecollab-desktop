"use client"

import { createContext, useContext } from "react"
import type { PortalModuleThemeTokens } from "@/lib/portal-module-themes"
import { themeFromFamily, PORTAL_DEFAULT_FAMILY } from "@/lib/portal-module-themes"

const MessagesThemeContext = createContext<PortalModuleThemeTokens>(
  themeFromFamily(PORTAL_DEFAULT_FAMILY),
)

export function MessagesThemeProvider({
  theme,
  children,
}: {
  theme: PortalModuleThemeTokens
  children: React.ReactNode
}) {
  return <MessagesThemeContext.Provider value={theme}>{children}</MessagesThemeContext.Provider>
}

export function useMessagesTheme() {
  return useContext(MessagesThemeContext)
}
