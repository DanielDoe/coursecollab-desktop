"use client"

import { useEffect, useMemo, useState } from "react"
import { useAppearance } from "@/components/appearance/AppearanceProvider"

function readDomDark(): boolean {
  if (typeof document === "undefined") return false
  return document.documentElement.classList.contains("dark")
}

/** Monaco + panel theme aligned with AppearanceProvider and the live `dark` class on `<html>`. */
export function useCodebenchMonacoTheme() {
  const { isDark, ready } = useAppearance()
  const [domDark, setDomDark] = useState(false)

  useEffect(() => {
    setDomDark(readDomDark())
    const root = document.documentElement
    const observer = new MutationObserver(() => setDomDark(readDomDark()))
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  const resolvedDark = useMemo(() => {
    if (domDark) return true
    if (ready) return isDark
    return false
  }, [domDark, isDark, ready])

  return {
    isDark: resolvedDark,
    panelTheme: resolvedDark ? ("dark" as const) : ("light" as const),
    editorTheme: resolvedDark ? ("codebench-dark" as const) : ("codebench-light" as const),
  }
}
