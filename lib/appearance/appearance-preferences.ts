import {
  DEFAULT_APPEARANCE_MODE,
  DEFAULT_THEME_ID,
  THEME_DEFINITIONS,
  type AppearanceMode,
  type ThemeId,
} from "@/lib/appearance/app-themes"
import {
  DEFAULT_SEMANTIC_PALETTE_ID,
  VALID_SEMANTIC_PALETTE_IDS,
  type SemanticPaletteId,
} from "@/lib/appearance/semantic-palettes"

export type { SemanticPaletteId }

export type AppearancePrefs = {
  appearanceMode: AppearanceMode
  themeId: ThemeId
  /** Optional layer 2: per-module semantic colors (homework=orange, attendance=blue, …). Default off. */
  semanticColorsEnabled: boolean
  /** Which semantic hue scheme when layer 2 is on */
  semanticPaletteId: SemanticPaletteId
}

export const APPEARANCE_PREFS_KEY = "course-collab.appearance-prefs"
/** Legacy key from pre-appearance light/dark toggle */
const LEGACY_THEME_KEY = "theme"

export const DEFAULT_APPEARANCE_PREFS: AppearancePrefs = {
  appearanceMode: DEFAULT_APPEARANCE_MODE,
  themeId: DEFAULT_THEME_ID,
  semanticColorsEnabled: false,
  semanticPaletteId: DEFAULT_SEMANTIC_PALETTE_ID,
}

const VALID_MODES: AppearanceMode[] = ["light", "dark", "system"]
/** Keep in sync with THEME_DEFINITIONS — never hard-trim restored themes here. */
const VALID_THEMES: ThemeId[] = THEME_DEFINITIONS.map((t) => t.id)

function normalizePrefs(raw: Partial<AppearancePrefs> | null | undefined): AppearancePrefs {
  return {
    appearanceMode: VALID_MODES.includes(raw?.appearanceMode as AppearanceMode)
      ? (raw!.appearanceMode as AppearanceMode)
      : DEFAULT_APPEARANCE_MODE,
    themeId: VALID_THEMES.includes(raw?.themeId as ThemeId)
      ? (raw!.themeId as ThemeId)
      : DEFAULT_THEME_ID,
    semanticColorsEnabled: raw?.semanticColorsEnabled === true,
    semanticPaletteId: VALID_SEMANTIC_PALETTE_IDS.includes(raw?.semanticPaletteId as SemanticPaletteId)
      ? (raw!.semanticPaletteId as SemanticPaletteId)
      : DEFAULT_SEMANTIC_PALETTE_ID,
  }
}

export function getAppearancePrefs(): AppearancePrefs {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE_PREFS
  try {
    const raw = localStorage.getItem(APPEARANCE_PREFS_KEY)
    if (raw) return normalizePrefs(JSON.parse(raw) as Partial<AppearancePrefs>)
    const legacy = localStorage.getItem(LEGACY_THEME_KEY)
    if (legacy === "dark" || legacy === "light") {
      return normalizePrefs({ appearanceMode: legacy, themeId: DEFAULT_THEME_ID })
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_APPEARANCE_PREFS
}

export function saveAppearancePrefs(prefs: AppearancePrefs): void {
  if (typeof window === "undefined") return
  localStorage.setItem(APPEARANCE_PREFS_KEY, JSON.stringify(normalizePrefs(prefs)))
  localStorage.setItem(LEGACY_THEME_KEY, prefs.appearanceMode === "system" ? "light" : prefs.appearanceMode)
}
