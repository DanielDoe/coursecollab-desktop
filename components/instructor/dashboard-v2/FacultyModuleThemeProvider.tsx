"use client"

import { createContext, useContext, useMemo, type CSSProperties } from "react"
import { usePathname } from "next/navigation"
import {
  getFacultyModuleThemeFromPath,
  type FacultyModuleThemeTokens,
} from "@/lib/faculty-module-themes"
import { semanticCssVar } from "@/lib/appearance/semantic-tokens"

const FacultyModuleThemeContext = createContext<FacultyModuleThemeTokens | null>(null)

export function FacultyModuleThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ""
  const theme = useMemo(() => getFacultyModuleThemeFromPath(pathname), [pathname])
  const moduleChromeStyle = useMemo(
    () =>
      ({
        "--cc-ui-switch-checked": semanticCssVar(theme.semantic),
      }) as CSSProperties,
    [theme.semantic],
  )
  return (
    <FacultyModuleThemeContext.Provider value={theme}>
      <div className="contents" style={moduleChromeStyle}>
        {children}
      </div>
    </FacultyModuleThemeContext.Provider>
  )
}

export function useFacultyModuleThemeContext(): FacultyModuleThemeTokens {
  const ctx = useContext(FacultyModuleThemeContext)
  if (!ctx) return getFacultyModuleThemeFromPath("")
  return ctx
}
