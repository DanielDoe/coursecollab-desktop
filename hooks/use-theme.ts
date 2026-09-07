"use client"

import { useAppearance } from "@/components/appearance/AppearanceProvider"

type Theme = "light" | "dark"

/** @deprecated Prefer useAppearance() for full theme + appearance mode control */
export function useTheme() {
  const { isDark, toggleLightDark, ready } = useAppearance()
  const theme: Theme = isDark ? "dark" : "light"
  return { theme, toggleTheme: toggleLightDark, ready }
}
