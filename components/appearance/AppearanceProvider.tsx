"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  DEFAULT_APPEARANCE_MODE,
  DEFAULT_THEME_ID,
  resolveThemeTokens,
  type AppearanceMode,
  type AppThemeTokens,
  type ThemeId,
} from "@/lib/appearance/app-themes"
import {
  DEFAULT_APPEARANCE_PREFS,
  getAppearancePrefs,
  saveAppearancePrefs,
  type SemanticPaletteId,
} from "@/lib/appearance/appearance-preferences"
import { DEFAULT_SEMANTIC_PALETTE_ID } from "@/lib/appearance/semantic-palettes"
import { applyWebTheme } from "@/lib/appearance/apply-web-theme"

type AppearanceContextValue = {
  ready: boolean
  appearanceMode: AppearanceMode
  themeId: ThemeId
  semanticColorsEnabled: boolean
  semanticPaletteId: SemanticPaletteId
  systemScheme: "light" | "dark"
  tokens: AppThemeTokens
  isDark: boolean
  setAppearanceMode: (mode: AppearanceMode) => void
  setThemeId: (id: ThemeId) => void
  setSemanticColorsEnabled: (enabled: boolean) => void
  setSemanticPaletteId: (id: SemanticPaletteId) => void
  toggleLightDark: () => void
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

function readSystemScheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [appearanceMode, setAppearanceModeState] = useState<AppearanceMode>(DEFAULT_APPEARANCE_MODE)
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID)
  const [semanticColorsEnabled, setSemanticColorsEnabledState] = useState(false)
  const [semanticPaletteId, setSemanticPaletteIdState] = useState<SemanticPaletteId>(DEFAULT_SEMANTIC_PALETTE_ID)
  const [systemScheme, setSystemScheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const prefs = getAppearancePrefs()
    setAppearanceModeState(prefs.appearanceMode)
    setThemeIdState(prefs.themeId)
    setSemanticColorsEnabledState(prefs.semanticColorsEnabled)
    setSemanticPaletteIdState(prefs.semanticPaletteId)
    setSystemScheme(readSystemScheme())
    setReady(true)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => setSystemScheme(mq.matches ? "dark" : "light")
    onChange()
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const tokens = useMemo(
    () => resolveThemeTokens(themeId, appearanceMode, systemScheme),
    [themeId, appearanceMode, systemScheme],
  )

  useEffect(() => {
    if (!ready) return
    applyWebTheme(tokens, { semanticColorsEnabled, semanticPaletteId })
  }, [tokens, ready, semanticColorsEnabled, semanticPaletteId])

  const toggleLightDark = useCallback(() => {
    const next: AppearanceMode = tokens.isDark ? "light" : "dark"
    setAppearanceModeState(next)
  }, [tokens.isDark])

  const persistSkip = useRef(true)
  useEffect(() => {
    if (!ready) return
    if (persistSkip.current) {
      persistSkip.current = false
      return
    }
    saveAppearancePrefs({ appearanceMode, themeId, semanticColorsEnabled, semanticPaletteId })
  }, [appearanceMode, themeId, semanticColorsEnabled, semanticPaletteId, ready])

  const setAppearanceMode = useCallback((mode: AppearanceMode) => {
    setAppearanceModeState(mode)
  }, [])

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id)
  }, [])

  const setSemanticColorsEnabled = useCallback((enabled: boolean) => {
    setSemanticColorsEnabledState(enabled)
  }, [])

  const setSemanticPaletteId = useCallback((id: SemanticPaletteId) => {
    setSemanticPaletteIdState(id)
  }, [])

  const value = useMemo(
    () => ({
      ready,
      appearanceMode,
      themeId,
      semanticColorsEnabled,
      semanticPaletteId,
      systemScheme,
      tokens,
      isDark: tokens.isDark,
      setAppearanceMode,
      setThemeId,
      setSemanticColorsEnabled,
      setSemanticPaletteId,
      toggleLightDark,
    }),
    [
      ready,
      appearanceMode,
      themeId,
      semanticColorsEnabled,
      semanticPaletteId,
      systemScheme,
      tokens,
      setAppearanceMode,
      setThemeId,
      setSemanticColorsEnabled,
      setSemanticPaletteId,
      toggleLightDark,
    ],
  )

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext)
  if (!ctx) {
    return {
      ready: false,
      appearanceMode: DEFAULT_APPEARANCE_PREFS.appearanceMode,
      themeId: DEFAULT_APPEARANCE_PREFS.themeId,
      semanticColorsEnabled: false,
      semanticPaletteId: DEFAULT_SEMANTIC_PALETTE_ID,
      systemScheme: "light",
      tokens: resolveThemeTokens(DEFAULT_THEME_ID, DEFAULT_APPEARANCE_MODE, "light"),
      isDark: false,
      setAppearanceMode: () => {},
      setThemeId: () => {},
      setSemanticColorsEnabled: () => {},
      setSemanticPaletteId: () => {},
      toggleLightDark: () => {},
    }
  }
  return ctx
}
