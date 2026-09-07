/**
 * Portal-wide module chrome (student, faculty, admin, guest).
 *
 * Shell accent = primary CTAs / active nav.
 * Content chrome = one Color Hunt palette per hue family (soft → deep),
 * close to the theme but with enough stops that lists/chips aren't monotonous.
 */

import {
  resolveThemeTokens,
  THEME_DEFINITIONS,
  type AppThemeTokens,
  type ThemeId,
} from "@/lib/appearance/app-themes"
import {
  COLOR_HUNT_PALETTES,
  GOLD_COMPLEMENT_PALETTES,
  GREEN_COMPLEMENT_PALETTES,
  PURPLE_COMPLEMENT_PALETTES,
  contentSwatchForFamily,
} from "@/lib/student-color-hunt-theme"

export type ModuleChromeFamily = "blue" | "purple" | "gold" | "red" | "green" | "pink" | "neutral"

/** Four-stop solid palette: soft → mid-light → mid → deep. */
export type ChromeSwatch = readonly [string, string, string, string]

type AccentTokenPick = Pick<
  AppThemeTokens,
  "accent" | "accentHover" | "tint" | "selected" | "secondaryAccent" | "isDark"
>

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function parseHex(hex: string): [number, number, number] | null {
  const h = hex.trim().replace("#", "")
  if (h.length === 3) {
    return [parseInt(h[0]! + h[0]!, 16), parseInt(h[1]! + h[1]!, 16), parseInt(h[2]! + h[2]!, 16)]
  }
  if (h.length !== 6) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, "0")).join("")}`
}

/** Mix `a` toward `b` by t (0 = a, 1 = b). */
export function mixHex(a: string, b: string, t: number): string {
  const A = parseHex(a)
  const B = parseHex(b)
  if (!A || !B) return a
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t)
}

function relativeLuma(hex: string): number {
  const rgb = parseHex(hex)
  if (!rgb) return 0.5
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
}

/**
 * One curated Color Hunt palette per family — combination guides near the shell hue.
 * Do not mix stops across families in the same surface.
 */
const FAMILY_CONTENT_SWATCH: Record<ModuleChromeFamily, ChromeSwatch> = {
  purple: contentSwatchForFamily("purple"),
  gold: contentSwatchForFamily("gold"),
  red: contentSwatchForFamily("red"),
  green: contentSwatchForFamily("green"),
  pink: contentSwatchForFamily("pink"),
  blue: contentSwatchForFamily("blue"),
  neutral: contentSwatchForFamily("neutral"),
}

/** Explicit theme → family (featured + common ids). */
const THEME_CHROME_FAMILY: Partial<Record<ThemeId, ModuleChromeFamily>> = {
  "apple-lavender": "purple",
  "pvamu-purple": "purple",
  indigo: "purple",
  midnight: "purple",
  aurora: "purple",
  carbon: "purple",
  graphite: "purple",
  "graphite-dark": "purple",
  "liquid-glass": "purple",
  pearl: "purple",

  emerald: "green",
  "forest-mist": "green",
  "meridian-teal": "green",
  "moss-night": "green",

  ocean: "blue",
  frost: "blue",
  arctic: "blue",
  "liquid-ocean": "blue",
  "executive-navy": "blue",

  "pvamu-gold": "gold",
  "copper-luxe": "gold",
  sunset: "gold",
  "ember-forge": "gold",
  "bronze-dark": "gold",

  "cougar-crimson": "red",
  "professional-crimson": "red",
  "heritage-wine": "red",
  "university-of-houston-steel": "red",
  "garnet-night": "red",
  "rose-quartz": "pink",

  titanium: "neutral",
  "frosted-titanium": "neutral",
  "obsidian-glass": "neutral",
  gunmetal: "neutral",
}

/** Exact Color Hunt 4-stops for themes that need a locked palette (soft → deep). */
export const THEME_CHROME_SWATCH: Partial<Record<ThemeId, ChromeSwatch>> = {
  /** https://colorhunt.co/palette/eee2deea906cb313122b2a4c */
  "university-of-houston-steel": ["#EEE2DE", "#EA906C", "#B31312", "#2B2A4C"],
}

export function themeChromeFamily(themeId: ThemeId): ModuleChromeFamily {
  const mapped = THEME_CHROME_FAMILY[themeId]
  if (mapped) return mapped

  const accent = resolveThemeTokens(themeId, "light", "light").accent
  const rgb = parseHex(accent)
  if (!rgb) return "neutral"
  const [r, g, b] = rgb
  if (r > 180 && g > 120 && b < 110) return "gold"
  if (r > 160 && g < 110 && b < 110) return "red"
  if (g > r + 10 && g > b && g > 120) return "green"
  if (r > 170 && b > 130 && g < 150) return "pink"
  if (b > r && r > 90 && b > 140) return "purple"
  if (b > r && b > g) return "blue"
  return "neutral"
}

export function chromeSwatchForFamily(family: ModuleChromeFamily): ChromeSwatch {
  return FAMILY_CONTENT_SWATCH[family]
}

/**
 * Content chrome for a theme: Color Hunt family palette, dark-adapted when needed.
 * Mid stop is nudged toward the live accent so it stays close to the shell.
 */
export function chromeSwatchFromTokens(
  tokens: AccentTokenPick,
  themeId?: ThemeId,
): ChromeSwatch {
  const locked = themeId ? THEME_CHROME_SWATCH[themeId] : undefined
  const family = themeId ? themeChromeFamily(themeId) : inferFamilyFromAccent(tokens.accent)
  const bank = locked ?? FAMILY_CONTENT_SWATCH[family]
  const accent = locked ? locked[2] : tokens.accent
  const [soft0, mid0, mid1, deep0] = bank

  // Keep mid near the shell accent (close enough), keep soft/deep from the palette for range.
  const mid = locked ? mid1 : mixHex(mid1, accent, 0.55)
  const deep = locked
    ? deep0
    : relativeLuma(tokens.accentHover || deep0) < relativeLuma(mid)
      ? tokens.accentHover || deep0
      : mixHex(deep0, accent, 0.35)

  if (tokens.isDark) {
    if (locked) {
      // Navy-led dark steel: deepen cream/peach stops against #2B2A4C
      const soft = mixHex(soft0, deep0, 0.78)
      const midLight = mixHex(mid0, deep0, 0.55)
      const midDark = mixHex(mid1, soft0, 0.35)
      return [soft, midLight, midDark, deep0]
    }
    const soft = mixHex(mid, "#0B0F14", 0.72)
    const midLight = mixHex(mid, "#0B0F14", 0.48)
    return [soft, midLight, mid, deep]
  }

  if (locked) {
    return [soft0, mid0, mid1, deep0]
  }

  let soft = soft0
  let midLight = mid0
  // Soft fills should stay light; if palette soft is very saturated, wash it.
  if (relativeLuma(soft) < 0.78) soft = mixHex(soft0, "#FFFFFF", 0.55)
  if (relativeLuma(midLight) <= relativeLuma(soft)) midLight = mixHex(soft, mid, 0.4)
  if (relativeLuma(mid) <= relativeLuma(midLight)) {
    midLight = mixHex(mid, "#FFFFFF", 0.45)
  }
  return [soft, midLight, mid, deep]
}

function inferFamilyFromAccent(accent: string): ModuleChromeFamily {
  const rgb = parseHex(accent)
  if (!rgb) return "neutral"
  const [r, g, b] = rgb
  if (r > 180 && g > 120 && b < 110) return "gold"
  if (r > 160 && g < 110 && b < 110) return "red"
  if (g > r + 10 && g > b && g > 120) return "green"
  if (r > 170 && b > 130 && g < 150) return "pink"
  if (b > r && r > 90 && b > 140) return "purple"
  if (b > r && b > g) return "blue"
  return "neutral"
}

export function chromeSwatchForTheme(
  themeId: ThemeId,
  appearanceMode: "light" | "dark" | "system" = "light",
  systemScheme: "light" | "dark" = "light",
): ChromeSwatch {
  const tokens = resolveThemeTokens(themeId, appearanceMode, systemScheme)
  return chromeSwatchFromTokens(tokens, themeId)
}

/**
 * Recommended / onboarding highlights — full catalog remains available in
 * Appearance & themes via getAppearancePickerThemes().
 */
export const FEATURED_THEME_IDS: readonly ThemeId[] = [
  "apple-lavender",
  "pvamu-purple",
  "pvamu-gold",
  "cougar-crimson",
  "university-of-houston-steel",
  "professional-crimson",
  "executive-navy",
  "heritage-wine",
  "meridian-teal",
  "copper-luxe",
  "emerald",
  "forest-mist",
  "graphite",
  "titanium",
  "pearl",
  "frosted-titanium",
  "ocean",
  "arctic",
  "liquid-glass",
  "liquid-ocean",
  "aurora",
  "frost",
  "midnight",
  "graphite-dark",
  "carbon",
  "obsidian-glass",
  "indigo",
  "sunset",
  "rose-quartz",
] as const

const FEATURED_SET = new Set<string>(FEATURED_THEME_IDS)

export function isFeaturedTheme(themeId: ThemeId): boolean {
  return FEATURED_SET.has(themeId)
}

/** Picker list: full catalog (all defined themes). */
export function getAppearancePickerThemes(_currentThemeId?: ThemeId) {
  return THEME_DEFINITIONS
}

/**
 * Hue-similarity sections for Appearance & themes UI.
 * Every ThemeId must appear exactly once across sections (no deletions).
 * `chromeFamily` / `chromeFamilies` drive the Color Hunt swatch(es) in the picker.
 * Campus classics is mixed — use `chromeFamilies` so we do not imply one palette.
 */
export const APPEARANCE_PICKER_GROUPS: readonly {
  id: string
  title: string
  description: string
  chromeFamily?: ModuleChromeFamily
  chromeFamilies?: readonly ModuleChromeFamily[]
  lockedPaletteLabel: string
  themeIds: readonly ThemeId[]
}[] = [
  {
    id: "school",
    title: "Campus classics",
    description:
      "CourseCollab default plus PVAMU and UH brand looks — each theme keeps its own module family (purple, gold, or red)",
    chromeFamilies: ["purple", "gold", "red"],
    lockedPaletteLabel: "Per-theme families",
    themeIds: [
      "apple-lavender",
      "pvamu-purple",
      "pvamu-gold",
      "cougar-crimson",
      "university-of-houston-steel",
    ],
  },
  {
    id: "violet",
    title: "Twilight atelier",
    description: "Module chrome: Atelier Night — Color Hunt 3a1078…",
    chromeFamily: "purple",
    lockedPaletteLabel: "Atelier Night",
    themeIds: [
      "indigo",
      "graphite",
      "graphite-dark",
      "carbon",
      "midnight",
      "aurora",
      "liquid-glass",
      "pearl",
    ],
  },
  {
    id: "blue",
    title: "Horizon waters",
    description: "Module chrome: Material Blue — Color Hunt e3f2fd…",
    chromeFamily: "blue",
    lockedPaletteLabel: "Material Blue",
    themeIds: ["ocean", "liquid-ocean", "arctic", "frost", "executive-navy"],
  },
  {
    id: "green",
    title: "Verdant commons",
    description: "Module chrome: Material Green — Color Hunt e8f5e9…",
    chromeFamily: "green",
    lockedPaletteLabel: "Material Green",
    themeIds: ["emerald", "forest-mist", "meridian-teal", "moss-night"],
  },
  {
    id: "warm",
    title: "Ember & copper",
    description: "Module chrome: Warm Flame — Color Hunt e73f1e…",
    chromeFamily: "gold",
    lockedPaletteLabel: "Warm Flame",
    themeIds: ["sunset", "copper-luxe", "ember-forge", "bronze-dark"],
  },
  {
    id: "red",
    title: "Crimson gallery",
    description: "Module chrome: Crimson Cream — Color Hunt be1a1a… (pink uses Coral Violet)",
    chromeFamily: "red",
    lockedPaletteLabel: "Crimson Cream",
    themeIds: ["professional-crimson", "heritage-wine", "rose-quartz", "garnet-night"],
  },
  {
    id: "neutral",
    title: "Quiet metals",
    description: "Module chrome: Quiet Slate — Color Hunt f1f6f9…",
    chromeFamily: "neutral",
    lockedPaletteLabel: "Quiet Slate",
    themeIds: ["titanium", "frosted-titanium", "obsidian-glass", "gunmetal"],
  },
] as const

export type AppearancePickerThemeGroup = {
  id: string
  title: string
  description: string
  chromeFamily: ModuleChromeFamily
  lockedPaletteLabel: string
  /** One locked swatch, or several when the section mixes families (campus). */
  chromeSwatches: ChromeSwatch[]
  themes: typeof THEME_DEFINITIONS
}

/** Full catalog, ordered into hue-similarity sections for the Appearance picker. */
export function getAppearancePickerThemeGroups(): AppearancePickerThemeGroup[] {
  const byId = new Map(THEME_DEFINITIONS.map((def) => [def.id, def]))
  const used = new Set<ThemeId>()
  const groups: AppearancePickerThemeGroup[] = []

  for (const group of APPEARANCE_PICKER_GROUPS) {
    const themes = group.themeIds
      .map((id) => byId.get(id))
      .filter((def): def is (typeof THEME_DEFINITIONS)[number] => Boolean(def))
    for (const def of themes) used.add(def.id)
    if (themes.length > 0) {
      const families =
        group.chromeFamilies ?? (group.chromeFamily ? [group.chromeFamily] : (["neutral"] as const))
      groups.push({
        id: group.id,
        title: group.title,
        description: group.description,
        chromeFamily: families[0] ?? "neutral",
        lockedPaletteLabel: group.lockedPaletteLabel,
        chromeSwatches: families.map((family) => FAMILY_CONTENT_SWATCH[family]),
        themes,
      })
    }
  }

  const remainder = THEME_DEFINITIONS.filter((def) => !used.has(def.id))
  if (remainder.length > 0) {
    groups.push({
      id: "other",
      title: "Other",
      description: "Additional themes not yet assigned to a hue group",
      chromeFamily: "neutral",
      lockedPaletteLabel: "Quiet Slate",
      chromeSwatches: [FAMILY_CONTENT_SWATCH.neutral],
      themes: remainder,
    })
  }

  return groups
}

/** Suggestion banks — locked chrome first, then catalog alternates. */
export const CHROME_PALETTE_SUGGESTIONS = {
  purple: {
    atelierNight: COLOR_HUNT_PALETTES.atelierNight,
    violetHarbor: COLOR_HUNT_PALETTES.violetHarbor,
    ...PURPLE_COMPLEMENT_PALETTES,
  },
  green: {
    ...GREEN_COMPLEMENT_PALETTES,
    mintGrove: COLOR_HUNT_PALETTES.mintGrove,
    materialGreen: COLOR_HUNT_PALETTES.materialGreen,
  },
  gold: {
    ...GOLD_COMPLEMENT_PALETTES,
    warmFlame: COLOR_HUNT_PALETTES.warmFlame,
  },
  blue: {
    materialBlue: COLOR_HUNT_PALETTES.materialBlue,
    oceanClear: COLOR_HUNT_PALETTES.oceanClear,
    coolGold: COLOR_HUNT_PALETTES.coolGold,
  },
  red: {
    crimsonCream: COLOR_HUNT_PALETTES.crimsonCream,
    wineParchment: COLOR_HUNT_PALETTES.wineParchment,
    roseAmber: COLOR_HUNT_PALETTES.roseAmber,
  },
  pink: { coralViolet: COLOR_HUNT_PALETTES.coralViolet },
  neutral: {
    quietSlate: COLOR_HUNT_PALETTES.quietSlate,
    softSteel: COLOR_HUNT_PALETTES.softSteel,
  },
} as const
