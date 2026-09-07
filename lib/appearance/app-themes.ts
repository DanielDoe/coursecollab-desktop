/**
 * Premium appearance themes — enterprise SaaS tokens.
 * Neutral surfaces + accent-only color; shared design language across all themes.
 */

export type AppearanceMode = "light" | "dark" | "system"

export type ThemeId =
  | "apple-lavender"
  | "graphite"
  | "ocean"
  | "emerald"
  | "midnight"
  | "graphite-dark"
  | "frost"
  | "titanium"
  | "indigo"
  | "sunset"
  | "rose-quartz"
  | "arctic"
  | "liquid-glass"
  | "liquid-ocean"
  | "aurora"
  | "carbon"
  | "pearl"
  | "frosted-titanium"
  | "obsidian-glass"
  | "forest-mist"
  | "professional-crimson"
  | "executive-navy"
  | "meridian-teal"
  | "heritage-wine"
  | "copper-luxe"
  | "cougar-crimson"
  | "university-of-houston-steel"
  | "pvamu-purple"
  | "pvamu-gold"
  | "moss-night"
  | "ember-forge"
  | "bronze-dark"
  | "garnet-night"
  | "gunmetal"

export type ThemeGlassTokens = {
  surface: string
  border: string
  blurRadius: number
  highlight: string
  opacity: number
}

export type ThemeButtonTokens = {
  radius: number
  style: "filled" | "glass"
}

export type ThemeNavigationTokens = {
  style: "standard" | "floating-glass"
}

export type ThemePalette = {
  accent: string
  accentHover: string
  secondaryAccent?: string
  tint: string
  selected: string
  border: string
  surface: string
  elevatedSurface?: string
  background: string
  card: string
  text: string
  textSecondary: string
  textMuted: string
  success: string
  warning: string
  danger: string
  isDark: boolean
  /** Frost / Liquid Glass — translucent chrome surfaces */
  surfaceGlass?: string
  glassBorder?: string
  /** Blur radius hint for glass themes (chrome only) */
  blurRadius?: number
  /** Soft ambient background gradient stops */
  backgroundGradient?: readonly [string, string] | readonly [string, string, string]
  chartPalette?: readonly string[]
  navigationStyle?: ThemeNavigationTokens["style"]
  buttonStyle?: ThemeButtonTokens["style"]
}

export type HeroThemeTokens = {
  gradientSoft: [string, string, string]
  avatar: [string, string]
  bubbleA: string
  bubbleB: string
  bubbleC: string
  pillBorder: string
  pillText: string
  codeText: string
  sheetGradient: [string, string, string]
  sheetWash: [string, string, string]
  promoStripe: string
}

export type AppThemeTokens = ThemePalette & {
  id: ThemeId
  name: string
  tagline: string
  isDefault?: boolean
  hero: HeroThemeTokens
  accentSoft: string
  accentSoftStrong: string
  accentBorder: string
  accentDark: string
  secondaryAccent: string
  elevatedSurface: string
  chartPalette: readonly string[]
  glass: ThemeGlassTokens
  button: ThemeButtonTokens
  navigation: ThemeNavigationTokens
  native: {
    groupedBackground: string
    secondaryGrouped: string
    tertiaryGrouped: string
    separator: string
    separatorOpaque: string
    label: string
    secondaryLabel: string
    tertiaryLabel: string
    tint: string
    fill: string
    accent: string
    accentSoft: string
    accentDark: string
    destructive: string
    switchTrackOff: string
    switchTrackOn: string
    switchIosOffBackground: string
    switchAndroidThumbOn: string
    switchAndroidThumbOff: string
  }
  chrome: {
    headerBg: string
    headerBorder: string
    sheetBg: string
    groupedBg: string
    groupedBorder: string
    separator: string
    label: string
    secondaryLabel: string
    tertiaryLabel: string
    tint: string
  }
  cardShadow: {
    shadowColor: string
    shadowOffset: { width: number; height: number }
    shadowOpacity: number
    shadowRadius: number
    elevation: number
  }
}

export type ThemeDefinition = {
  id: ThemeId
  name: string
  tagline: string
  isDefault?: boolean
  /** When true, always renders dark palette regardless of appearance mode */
  forceDark?: boolean
  light: Omit<ThemePalette, "isDark">
  dark: Omit<ThemePalette, "isDark">
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "")
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function buildSwitchColors(palette: ThemePalette) {
  const trackOff = palette.isDark ? "rgba(255,255,255,0.16)" : palette.border
  return {
    switchTrackOff: trackOff,
    switchTrackOn: palette.accent,
    switchIosOffBackground: trackOff,
    switchAndroidThumbOn: "#ffffff",
    switchAndroidThumbOff: palette.isDark ? palette.textSecondary : "#f4f3f4",
  }
}

function buildTokens(def: ThemeDefinition, palette: ThemePalette): AppThemeTokens {
  const { accent, isDark } = palette
  const separator = isDark ? "rgba(255,255,255,0.12)" : palette.border
  const fill = isDark ? "rgba(255,255,255,0.08)" : hexToRgba(accent, 0.08)
  const glassSurface = palette.surfaceGlass ?? (isDark ? hexToRgba(palette.surface, 0.72) : hexToRgba(palette.surface, 0.92))
  const glassBorder = palette.glassBorder ?? (isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.35)")
  const blurRadius = palette.blurRadius ?? 0
  const isGlassNav = palette.navigationStyle === "floating-glass" || blurRadius >= 20
  const chartPalette =
    palette.chartPalette ??
    ([accent, palette.secondaryAccent ?? palette.accentHover, palette.warning, palette.success, palette.danger] as const)
  const cardShadowOpacity = isGlassNav ? (isDark ? 0.22 : 0.06) : isDark ? 0.35 : 0.04
  const cardShadowRadius = isGlassNav ? (isDark ? 16 : 12) : isDark ? 12 : 8
  /** Glass themes keep blur on chrome; list/content rows need opaque fills for readable text. */
  const contentSurface = palette.surface
  const contentElevated =
    palette.elevatedSurface && !String(palette.elevatedSurface).startsWith("rgba")
      ? palette.elevatedSurface
      : palette.surface
  const chromeSurface = palette.surfaceGlass ?? glassSurface

  return {
    ...palette,
    id: def.id,
    name: def.name,
    tagline: def.tagline,
    isDefault: def.isDefault,
    secondaryAccent: palette.secondaryAccent ?? palette.accentHover,
    elevatedSurface: palette.elevatedSurface ?? palette.surface,
    chartPalette,
    glass: {
      surface: glassSurface,
      border: glassBorder,
      blurRadius,
      highlight: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.45)",
      opacity: blurRadius >= 20 ? 0.58 : 1,
    },
    button: {
      radius: isGlassNav ? 22 : 12,
      style: palette.buttonStyle ?? (isGlassNav ? "glass" : "filled"),
    },
    navigation: {
      style: palette.navigationStyle ?? (isGlassNav ? "floating-glass" : "standard"),
    },
    hero: {
      gradientSoft: palette.backgroundGradient
        ? ([palette.backgroundGradient[0], palette.background, palette.backgroundGradient[1]] as [string, string, string])
        : isDark
          ? [hexToRgba(accent, 0.18), palette.background, hexToRgba(palette.warning, 0.1)]
          : [palette.tint, palette.background, hexToRgba(palette.warning, 0.06)],
      avatar: [palette.accentHover, palette.accent],
      bubbleA: hexToRgba(accent, isDark ? 0.22 : 0.12),
      bubbleB: hexToRgba(palette.warning, isDark ? 0.2 : 0.14),
      bubbleC: hexToRgba(accent, isDark ? 0.16 : 0.1),
      pillBorder: hexToRgba(accent, 0.18),
      pillText: palette.accentHover,
      codeText: palette.accent,
      sheetGradient: isDark
        ? [hexToRgba(accent, 0.45), hexToRgba(accent, 0.28), palette.accentHover]
        : [palette.accentHover, palette.accent, palette.accentHover],
      sheetWash: [
        hexToRgba(accent, isDark ? 0.16 : 0.12),
        "transparent",
        hexToRgba(palette.warning, isDark ? 0.1 : 0.07),
      ],
      promoStripe: palette.warning,
    },
    accentSoft: isDark ? palette.tint : palette.selected,
    accentSoftStrong: hexToRgba(accent, isDark ? 0.22 : 0.2),
    accentBorder: palette.border,
    accentDark: palette.accentHover,
    native: {
      groupedBackground: palette.background,
      secondaryGrouped: contentSurface,
      tertiaryGrouped: contentElevated,
      separator,
      separatorOpaque: palette.border,
      label: palette.text,
      secondaryLabel: palette.textSecondary,
      tertiaryLabel: palette.textMuted,
      tint: palette.accent,
      fill,
      accent: palette.accent,
      accentSoft: isDark ? palette.tint : palette.selected,
      accentDark: palette.accentHover,
      destructive: palette.danger,
      ...buildSwitchColors(palette),
    },
    chrome: {
      headerBg: chromeSurface ?? (isDark ? hexToRgba(palette.surface, 0.92) : hexToRgba(palette.surface, 0.97)),
      headerBorder: separator,
      sheetBg: palette.background,
      groupedBg: contentSurface,
      groupedBorder: palette.border,
      separator,
      label: palette.text,
      secondaryLabel: palette.textSecondary,
      tertiaryLabel: palette.textMuted,
      tint: palette.accent,
    },
    cardShadow: {
      shadowColor: isDark ? "#000000" : "#101828",
      shadowOffset: { width: 0, height: isGlassNav ? 4 : 2 },
      shadowOpacity: cardShadowOpacity,
      shadowRadius: cardShadowRadius,
      elevation: isGlassNav ? (isDark ? 6 : 3) : isDark ? 4 : 2,
    },
  }
}

const SHARED_SUCCESS = { success: "#34C759", warning: "#FF9F0A", danger: "#FF453A" }

export const THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    id: "apple-lavender",
    name: "Apple Lavender",
    tagline: "Apple Journal · Craft",
    isDefault: true,
    light: {
      accent: "#6D5EF6",
      accentHover: "#5C4EF0",
      tint: "#F4F2FF",
      selected: "#EEE9FF",
      border: "#E7E4FF",
      surface: "#FFFFFF",
      background: "#FAFAFC",
      card: "#FFFFFF",
      text: "#111827",
      textSecondary: "#667085",
      textMuted: "#98A2B3",
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#8B7CFF",
      accentHover: "#9D91FF",
      tint: "#1E1B4B",
      selected: "#312E81",
      border: "#2D3138",
      surface: "#161B22",
      background: "#0D1117",
      card: "#161B22",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    tagline: "Linear · Raycast",
    light: {
      accent: "#4F46E5",
      accentHover: "#4338CA",
      tint: "#EEF2FF",
      selected: "#E0E7FF",
      border: "#E7EAF0",
      surface: "#FFFFFF",
      background: "#F8F9FB",
      card: "#FFFFFF",
      text: "#111827",
      textSecondary: "#667085",
      textMuted: "#6B7280",
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#818CF8",
      accentHover: "#A5B4FC",
      tint: "#1E1B4B",
      selected: "#312E81",
      border: "#2D3138",
      surface: "#1A1D21",
      background: "#111315",
      card: "#20242A",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    tagline: "Apple Weather",
    light: {
      accent: "#007AFF",
      accentHover: "#0066D6",
      tint: "#EAF4FF",
      selected: "#D6EBFF",
      border: "#D6E8FF",
      surface: "#FFFFFF",
      background: "#F8FBFF",
      card: "#FFFFFF",
      text: "#111827",
      textSecondary: "#667085",
      textMuted: "#98A2B3",
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#0A84FF",
      accentHover: "#409CFF",
      tint: "#0C1929",
      selected: "#1E3A5F",
      border: "#2B313A",
      surface: "#161B22",
      background: "#0D1117",
      card: "#161B22",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "emerald",
    name: "Emerald",
    tagline: "Fintech calm",
    light: {
      accent: "#10B981",
      accentHover: "#059669",
      tint: "#ECFDF5",
      selected: "#D1FAE5",
      border: "#D1FAE5",
      surface: "#FFFFFF",
      background: "#F8FCFA",
      card: "#FFFFFF",
      text: "#111827",
      textSecondary: "#667085",
      textMuted: "#98A2B3",
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#34D399",
      accentHover: "#6EE7B7",
      tint: "#064E3B",
      selected: "#065F46",
      border: "#2D3138",
      surface: "#161B22",
      background: "#0D1117",
      card: "#161B22",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    tagline: "Linear Dark · Vercel",
    forceDark: true,
    light: {
      accent: "#8B7CFF",
      accentHover: "#9D91FF",
      tint: "#1E1B4B",
      selected: "#312E81",
      border: "#2B313A",
      surface: "#161B22",
      background: "#0D1117",
      card: "#161B22",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#8B7CFF",
      accentHover: "#9D91FF",
      tint: "#1E1B4B",
      selected: "#312E81",
      border: "#2B313A",
      surface: "#161B22",
      background: "#0D1117",
      card: "#161B22",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "graphite-dark",
    name: "Graphite Dark",
    tagline: "Apple dark surfaces",
    forceDark: true,
    light: {
      accent: "#6D5EF6",
      accentHover: "#5C4EF0",
      tint: "#2A2640",
      selected: "#3D3660",
      border: "#2D3138",
      surface: "#1A1D21",
      background: "#111315",
      card: "#20242A",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#6D5EF6",
      accentHover: "#8B7CFF",
      tint: "#2A2640",
      selected: "#3D3660",
      border: "#2D3138",
      surface: "#1A1D21",
      background: "#111315",
      card: "#20242A",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "frost",
    name: "Frost",
    tagline: "Glass · minimal blur",
    light: {
      accent: "#8B5CF6",
      accentHover: "#7C3AED",
      tint: "#F5F3FF",
      selected: "#EDE9FE",
      border: "#E9E5FF",
      surface: "#FFFFFF",
      background: "#F3F4F6",
      card: "#FFFFFF",
      text: "#111827",
      textSecondary: "#667085",
      textMuted: "#98A2B3",
      surfaceGlass: "rgba(255,255,255,0.75)",
      blurRadius: 24,
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#A78BFA",
      accentHover: "#C4B5FD",
      tint: "#2E1065",
      selected: "#4C1D95",
      border: "#2D3138",
      surface: "#161B22",
      background: "#0D1117",
      card: "#161B22",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      surfaceGlass: "rgba(22,27,34,0.75)",
      blurRadius: 24,
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "titanium",
    name: "Titanium",
    tagline: "Apple Titanium",
    light: {
      accent: "#596273",
      accentHover: "#475569",
      tint: "#F5F6F8",
      selected: "#ECEEF2",
      border: "#D9DCE2",
      surface: "#FFFFFF",
      background: "#F5F6F8",
      card: "#FFFFFF",
      text: "#111827",
      textSecondary: "#667085",
      textMuted: "#98A2B3",
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#94A3B8",
      accentHover: "#CBD5E1",
      tint: "#1E293B",
      selected: "#334155",
      border: "#2D3138",
      surface: "#1A1D21",
      background: "#111315",
      card: "#20242A",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "indigo",
    name: "Indigo",
    tagline: "Modern SaaS",
    light: {
      accent: "#6366F1",
      accentHover: "#4F46E5",
      tint: "#EEF2FF",
      selected: "#E0E7FF",
      border: "#E4E7FF",
      surface: "#FFFFFF",
      background: "#FAFAFF",
      card: "#FFFFFF",
      text: "#111827",
      textSecondary: "#667085",
      textMuted: "#98A2B3",
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#818CF8",
      accentHover: "#A5B4FC",
      tint: "#1E1B4B",
      selected: "#312E81",
      border: "#2D3138",
      surface: "#161B22",
      background: "#0D1117",
      card: "#161B22",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    tagline: "Creators · education",
    light: {
      accent: "#F97316",
      accentHover: "#EA580C",
      tint: "#FFF5EC",
      selected: "#FFEDD5",
      border: "#FED7AA",
      surface: "#FFFFFF",
      background: "#FFFDFC",
      card: "#FFFFFF",
      text: "#111827",
      textSecondary: "#667085",
      textMuted: "#98A2B3",
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#FB923C",
      accentHover: "#FDBA74",
      tint: "#431407",
      selected: "#7C2D12",
      border: "#2D3138",
      surface: "#161B22",
      background: "#0D1117",
      card: "#161B22",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "rose-quartz",
    name: "Rose Quartz",
    tagline: "Subtle · refined",
    light: {
      accent: "#EC4899",
      accentHover: "#DB2777",
      tint: "#FFF1F7",
      selected: "#FCE7F3",
      border: "#FBCFE8",
      surface: "#FFFFFF",
      background: "#FFFDFC",
      card: "#FFFFFF",
      text: "#111827",
      textSecondary: "#667085",
      textMuted: "#98A2B3",
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#F472B6",
      accentHover: "#F9A8D4",
      tint: "#500724",
      selected: "#831843",
      border: "#2D3138",
      surface: "#161B22",
      background: "#0D1117",
      card: "#161B22",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "arctic",
    name: "Arctic",
    tagline: "Clean · airy",
    light: {
      accent: "#0EA5E9",
      accentHover: "#0284C7",
      tint: "#F0FAFF",
      selected: "#E0F2FE",
      border: "#BAE6FD",
      surface: "#FFFFFF",
      background: "#FBFDFF",
      card: "#FFFFFF",
      text: "#111827",
      textSecondary: "#667085",
      textMuted: "#98A2B3",
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#38BDF8",
      accentHover: "#7DD3FC",
      tint: "#0C4A6E",
      selected: "#075985",
      border: "#2D3138",
      surface: "#161B22",
      background: "#0D1117",
      card: "#161B22",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "liquid-glass",
    name: "Liquid Glass",
    tagline: "Apple · visionOS",
    light: {
      accent: "#6D5EF6",
      accentHover: "#5C4EF0",
      tint: "rgba(109,94,246,0.08)",
      selected: "rgba(109,94,246,0.14)",
      border: "rgba(255,255,255,0.35)",
      surface: "#FFFFFF",
      elevatedSurface: "rgba(255,255,255,0.72)",
      background: "#F8F7FC",
      backgroundGradient: ["#FFFFFF", "#F4F2FF"],
      card: "rgba(255,255,255,0.55)",
      text: "#1C1C1E",
      textSecondary: "#636366",
      textMuted: "#8E8E93",
      surfaceGlass: "rgba(255,255,255,0.55)",
      glassBorder: "rgba(255,255,255,0.35)",
      blurRadius: 28,
      navigationStyle: "floating-glass",
      buttonStyle: "glass",
      chartPalette: ["#6D5EF6", "#5C4EF0", "#34C759", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#8B7CFF",
      accentHover: "#9D91FF",
      tint: "rgba(139,124,255,0.14)",
      selected: "rgba(139,124,255,0.22)",
      border: "rgba(255,255,255,0.12)",
      surface: "#1C1C1E",
      elevatedSurface: "rgba(28,28,30,0.78)",
      background: "#000000",
      backgroundGradient: ["#0A0A0C", "#12121A"],
      card: "rgba(28,28,30,0.55)",
      text: "#F5F5F7",
      textSecondary: "#AEAEB2",
      textMuted: "#636366",
      surfaceGlass: "rgba(28,28,30,0.55)",
      glassBorder: "rgba(255,255,255,0.08)",
      blurRadius: 28,
      navigationStyle: "floating-glass",
      buttonStyle: "glass",
      chartPalette: ["#8B7CFF", "#9D91FF", "#34C759", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "liquid-ocean",
    name: "Liquid Ocean",
    tagline: "Apple Weather",
    light: {
      accent: "#007AFF",
      accentHover: "#0066D6",
      tint: "rgba(0,122,255,0.08)",
      selected: "rgba(0,122,255,0.14)",
      border: "rgba(255,255,255,0.35)",
      surface: "#FFFFFF",
      elevatedSurface: "rgba(255,255,255,0.58)",
      background: "#F5FAFF",
      backgroundGradient: ["#FFFFFF", "#EAF4FF"],
      card: "rgba(255,255,255,0.58)",
      text: "#111827",
      textSecondary: "#667085",
      textMuted: "#98A2B3",
      surfaceGlass: "rgba(255,255,255,0.58)",
      glassBorder: "rgba(255,255,255,0.35)",
      blurRadius: 28,
      navigationStyle: "floating-glass",
      buttonStyle: "glass",
      chartPalette: ["#007AFF", "#32ADE6", "#34C759", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#0A84FF",
      accentHover: "#409CFF",
      tint: "rgba(10,132,255,0.14)",
      selected: "rgba(10,132,255,0.22)",
      border: "rgba(255,255,255,0.1)",
      surface: "#161B22",
      elevatedSurface: "rgba(22,27,34,0.72)",
      background: "#0D1117",
      backgroundGradient: ["#0A0C10", "#0C1929"],
      card: "rgba(22,27,34,0.55)",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      surfaceGlass: "rgba(22,27,34,0.55)",
      glassBorder: "rgba(255,255,255,0.08)",
      blurRadius: 28,
      navigationStyle: "floating-glass",
      buttonStyle: "glass",
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "aurora",
    name: "Aurora",
    tagline: "Linear · Raycast",
    light: {
      accent: "#7C6CFF",
      secondaryAccent: "#39D0FF",
      accentHover: "#6A5AF5",
      tint: "rgba(124,108,255,0.08)",
      selected: "rgba(57,208,255,0.12)",
      border: "#E7E4FF",
      surface: "#FFFFFF",
      background: "#FAFAFF",
      backgroundGradient: ["#FFFFFF", "#F0FAFF", "#F4F2FF"],
      card: "#FFFFFF",
      text: "#111827",
      textSecondary: "#667085",
      textMuted: "#98A2B3",
      chartPalette: ["#7C6CFF", "#39D0FF", "#34C759", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#9D91FF",
      secondaryAccent: "#39D0FF",
      accentHover: "#B4ABFF",
      tint: "rgba(124,108,255,0.16)",
      selected: "rgba(57,208,255,0.14)",
      border: "#2D3138",
      surface: "#161B22",
      background: "#0D1117",
      backgroundGradient: ["#0A0C10", "#12121A", "#0C1929"],
      card: "#161B22",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      chartPalette: ["#9D91FF", "#39D0FF", "#34D399", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "carbon",
    name: "Carbon",
    tagline: "Arc · Vercel",
    forceDark: true,
    light: {
      accent: "#4F46E5",
      accentHover: "#6366F1",
      tint: "#1E1B4B",
      selected: "#312E81",
      border: "#2B313A",
      surface: "#181C22",
      elevatedSurface: "#20242A",
      background: "#0E1116",
      card: "#181C22",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      chartPalette: ["#6366F1", "#818CF8", "#34D399", "#FBBF24", "#F87171"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#4F46E5",
      accentHover: "#6366F1",
      tint: "#1E1B4B",
      selected: "#312E81",
      border: "#2B313A",
      surface: "#181C22",
      elevatedSurface: "#20242A",
      background: "#0E1116",
      card: "#181C22",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      chartPalette: ["#6366F1", "#818CF8", "#34D399", "#FBBF24", "#F87171"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "pearl",
    name: "Pearl",
    tagline: "Apple Notes · Calendar",
    light: {
      accent: "#5965FF",
      accentHover: "#4F5AE6",
      tint: "#F7F7F8",
      selected: "#EEEFF2",
      border: "#ECECEC",
      surface: "#FEFEFE",
      elevatedSurface: "#FFFFFF",
      background: "#FAFAF9",
      card: "#FFFFFF",
      text: "#1C1C1E",
      textSecondary: "#6B7280",
      textMuted: "#9CA3AF",
      chartPalette: ["#5965FF", "#8B93FF", "#34C759", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#8B93FF",
      accentHover: "#A5ABFF",
      tint: "#1C1C1E",
      selected: "#2C2C2E",
      border: "#38383A",
      surface: "#1C1C1E",
      elevatedSurface: "#2C2C2E",
      background: "#000000",
      card: "#1C1C1E",
      text: "#F5F5F7",
      textSecondary: "#AEAEB2",
      textMuted: "#636366",
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "frosted-titanium",
    name: "Frosted Titanium",
    tagline: "Apple Vision Pro",
    light: {
      accent: "#667085",
      accentHover: "#475569",
      tint: "#F5F6F8",
      selected: "#ECEEF2",
      border: "rgba(255,255,255,0.4)",
      surface: "rgba(255,255,255,0.72)",
      elevatedSurface: "rgba(255,255,255,0.82)",
      background: "#ECEEF2",
      backgroundGradient: ["#F5F6F8", "#D9DCE2", "#ECEEF2"],
      card: "rgba(255,255,255,0.65)",
      text: "#111827",
      textSecondary: "#667085",
      textMuted: "#98A2B3",
      surfaceGlass: "rgba(255,255,255,0.65)",
      glassBorder: "rgba(255,255,255,0.4)",
      blurRadius: 24,
      navigationStyle: "floating-glass",
      buttonStyle: "glass",
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#94A3B8",
      accentHover: "#CBD5E1",
      tint: "#1E293B",
      selected: "#334155",
      border: "rgba(255,255,255,0.1)",
      surface: "rgba(26,29,33,0.72)",
      elevatedSurface: "rgba(32,36,42,0.78)",
      background: "#111315",
      backgroundGradient: ["#111315", "#1A1D21", "#20242A"],
      card: "rgba(32,36,42,0.65)",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      surfaceGlass: "rgba(32,36,42,0.65)",
      glassBorder: "rgba(255,255,255,0.08)",
      blurRadius: 24,
      navigationStyle: "floating-glass",
      buttonStyle: "glass",
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "obsidian-glass",
    name: "Obsidian Glass",
    tagline: "Dark Liquid Glass · OLED",
    forceDark: true,
    light: {
      accent: "#8B7CFF",
      accentHover: "#9D91FF",
      tint: "rgba(139,124,255,0.14)",
      selected: "rgba(139,124,255,0.22)",
      border: "rgba(255,255,255,0.08)",
      surface: "#161B22",
      elevatedSurface: "rgba(30,35,42,0.55)",
      background: "#0A0C10",
      backgroundGradient: ["#000000", "#0A0C10"],
      card: "rgba(30,35,42,0.55)",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      surfaceGlass: "rgba(30,35,42,0.55)",
      glassBorder: "rgba(255,255,255,0.08)",
      blurRadius: 32,
      navigationStyle: "floating-glass",
      buttonStyle: "glass",
      chartPalette: ["#8B7CFF", "#9D91FF", "#34D399", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#8B7CFF",
      accentHover: "#9D91FF",
      tint: "rgba(139,124,255,0.14)",
      selected: "rgba(139,124,255,0.22)",
      border: "rgba(255,255,255,0.08)",
      surface: "#161B22",
      elevatedSurface: "rgba(30,35,42,0.55)",
      background: "#0A0C10",
      backgroundGradient: ["#000000", "#0A0C10"],
      card: "rgba(30,35,42,0.55)",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      surfaceGlass: "rgba(30,35,42,0.55)",
      glassBorder: "rgba(255,255,255,0.08)",
      blurRadius: 32,
      navigationStyle: "floating-glass",
      buttonStyle: "glass",
      chartPalette: ["#8B7CFF", "#9D91FF", "#34D399", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "forest-mist",
    name: "Forest Mist",
    tagline: "Organic · calm",
    light: {
      accent: "#10B981",
      accentHover: "#059669",
      tint: "#ECFDF5",
      selected: "#D1FAE5",
      border: "#D1FAE5",
      surface: "#FFFFFF",
      elevatedSurface: "#FFFFFF",
      background: "#F8FCFA",
      backgroundGradient: ["#FFFFFF", "#ECFDF5"],
      card: "#FFFFFF",
      text: "#111827",
      textSecondary: "#667085",
      textMuted: "#98A2B3",
      chartPalette: ["#10B981", "#34D399", "#059669", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#34D399",
      accentHover: "#6EE7B7",
      tint: "#064E3B",
      selected: "#065F46",
      border: "#2D3138",
      surface: "#161B22",
      elevatedSurface: "#1A2420",
      background: "#0D1117",
      backgroundGradient: ["#0A0F0D", "#0D1117"],
      card: "#161B22",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      chartPalette: ["#34D399", "#6EE7B7", "#10B981", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "professional-crimson",
    name: "Professional Crimson",
    tagline: "Executive · confident",
    light: {
      accent: "#E11D48",
      accentHover: "#BE123C",
      secondaryAccent: "#F43F5E",
      tint: "#FFF1F2",
      selected: "#FFE4E6",
      border: "#FECDD3",
      surface: "#FFFFFF",
      elevatedSurface: "#FFFFFF",
      background: "#FFFBFB",
      backgroundGradient: ["#FFFFFF", "#FFF1F2"],
      card: "#FFFFFF",
      text: "#0F172A",
      textSecondary: "#475569",
      textMuted: "#94A3B8",
      chartPalette: ["#E11D48", "#F43F5E", "#BE123C", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#F43F5E",
      accentHover: "#FB7185",
      secondaryAccent: "#FDA4AF",
      tint: "#4C0519",
      selected: "#881337",
      border: "#3F1724",
      surface: "#181116",
      elevatedSurface: "#221019",
      background: "#0C0709",
      backgroundGradient: ["#0C0709", "#181116"],
      card: "#181116",
      text: "#F8FAFC",
      textSecondary: "#CBD5E1",
      textMuted: "#94A3B8",
      chartPalette: ["#F43F5E", "#FB7185", "#FDA4AF", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "executive-navy",
    name: "Executive Navy",
    tagline: "Corporate · trusted",
    light: {
      accent: "#1D4ED8",
      accentHover: "#1E40AF",
      secondaryAccent: "#3B82F6",
      tint: "#EFF6FF",
      selected: "#DBEAFE",
      border: "#BFDBFE",
      surface: "#FFFFFF",
      elevatedSurface: "#FFFFFF",
      background: "#F8FAFC",
      backgroundGradient: ["#FFFFFF", "#EFF6FF"],
      card: "#FFFFFF",
      text: "#0F172A",
      textSecondary: "#475569",
      textMuted: "#94A3B8",
      chartPalette: ["#1D4ED8", "#3B82F6", "#60A5FA", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#60A5FA",
      accentHover: "#93C5FD",
      secondaryAccent: "#3B82F6",
      tint: "#172554",
      selected: "#1E3A8A",
      border: "#1E293B",
      surface: "#111827",
      elevatedSurface: "#1F2937",
      background: "#0B1120",
      backgroundGradient: ["#0B1120", "#111827"],
      card: "#111827",
      text: "#F8FAFC",
      textSecondary: "#CBD5E1",
      textMuted: "#94A3B8",
      chartPalette: ["#60A5FA", "#93C5FD", "#3B82F6", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "meridian-teal",
    name: "Meridian Teal",
    tagline: "Modern · precision",
    light: {
      accent: "#0D9488",
      accentHover: "#0F766E",
      secondaryAccent: "#14B8A6",
      tint: "#F0FDFA",
      selected: "#CCFBF1",
      border: "#99F6E4",
      surface: "#FFFFFF",
      elevatedSurface: "#FFFFFF",
      background: "#F8FFFE",
      backgroundGradient: ["#FFFFFF", "#F0FDFA"],
      card: "#FFFFFF",
      text: "#0F172A",
      textSecondary: "#475569",
      textMuted: "#94A3B8",
      chartPalette: ["#0D9488", "#14B8A6", "#2DD4BF", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#2DD4BF",
      accentHover: "#5EEAD4",
      secondaryAccent: "#14B8A6",
      tint: "#042F2E",
      selected: "#134E4A",
      border: "#1E3A38",
      surface: "#0F1917",
      elevatedSurface: "#152422",
      background: "#0A1211",
      backgroundGradient: ["#0A1211", "#0F1917"],
      card: "#0F1917",
      text: "#F8FAFC",
      textSecondary: "#CBD5E1",
      textMuted: "#94A3B8",
      chartPalette: ["#2DD4BF", "#5EEAD4", "#14B8A6", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "heritage-wine",
    name: "Heritage Wine",
    tagline: "Academic · distinguished",
    light: {
      accent: "#9F1239",
      accentHover: "#881337",
      secondaryAccent: "#BE123C",
      tint: "#FFF1F2",
      selected: "#FFE4E6",
      border: "#FECDD3",
      surface: "#FFFFFF",
      elevatedSurface: "#FFFFFF",
      background: "#FDF8F9",
      backgroundGradient: ["#FFFFFF", "#FFF5F7"],
      card: "#FFFFFF",
      text: "#1C1917",
      textSecondary: "#57534E",
      textMuted: "#A8A29E",
      chartPalette: ["#9F1239", "#BE123C", "#881337", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#FB7185",
      accentHover: "#FDA4AF",
      secondaryAccent: "#F43F5E",
      tint: "#500724",
      selected: "#831843",
      border: "#3B1724",
      surface: "#1A1014",
      elevatedSurface: "#241018",
      background: "#0F0A0C",
      backgroundGradient: ["#0F0A0C", "#1A1014"],
      card: "#1A1014",
      text: "#FAFAF9",
      textSecondary: "#D6D3D1",
      textMuted: "#A8A29E",
      chartPalette: ["#FB7185", "#FDA4AF", "#F43F5E", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "copper-luxe",
    name: "Copper Luxe",
    tagline: "Warm · premium",
    light: {
      accent: "#B45309",
      accentHover: "#92400E",
      secondaryAccent: "#D97706",
      tint: "#FFFBEB",
      selected: "#FEF3C7",
      border: "#FDE68A",
      surface: "#FFFFFF",
      elevatedSurface: "#FFFFFF",
      background: "#FFFCF7",
      backgroundGradient: ["#FFFFFF", "#FFFBEB"],
      card: "#FFFFFF",
      text: "#1C1917",
      textSecondary: "#57534E",
      textMuted: "#A8A29E",
      chartPalette: ["#B45309", "#D97706", "#F59E0B", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#FBBF24",
      accentHover: "#FCD34D",
      secondaryAccent: "#F59E0B",
      tint: "#451A03",
      selected: "#78350F",
      border: "#3D2E14",
      surface: "#1A1510",
      elevatedSurface: "#241C14",
      background: "#0F0C09",
      backgroundGradient: ["#0F0C09", "#1A1510"],
      card: "#1A1510",
      text: "#FAFAF9",
      textSecondary: "#D6D3D1",
      textMuted: "#A8A29E",
      chartPalette: ["#FBBF24", "#FCD34D", "#F59E0B", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "cougar-crimson",
    name: "Cougar Crimson",
    tagline: "University of Houston · official red",
    light: {
      accent: "#C8102E",
      accentHover: "#A50D25",
      secondaryAccent: "#6D6E71",
      tint: "#FDF2F4",
      selected: "#FCE4E8",
      border: "#F5C2CB",
      surface: "#FFFFFF",
      elevatedSurface: "#FFFFFF",
      background: "#FFFBFC",
      backgroundGradient: ["#FFFFFF", "#FDF2F4"],
      card: "#FFFFFF",
      text: "#1A1A1A",
      textSecondary: "#57534E",
      textMuted: "#78716C",
      chartPalette: ["#C8102E", "#6D6E71", "#34C759", "#FFB81C", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#E8193A",
      accentHover: "#FF3355",
      secondaryAccent: "#9CA3AF",
      tint: "#3B0A14",
      selected: "#5C1220",
      border: "#3F1724",
      surface: "#1A1012",
      elevatedSurface: "#241018",
      background: "#0F0A0B",
      backgroundGradient: ["#0F0A0B", "#1A1012"],
      card: "#1A1012",
      text: "#FAFAF9",
      textSecondary: "#D6D3D1",
      textMuted: "#A8A29E",
      chartPalette: ["#E8193A", "#FF3355", "#34D399", "#FFB81C", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "university-of-houston-steel",
    name: "UH Steel",
    tagline: "University of Houston · cream, peach, brick & navy steel",
    light: {
      accent: "#B31312",
      accentHover: "#8F0F0E",
      secondaryAccent: "#EA906C",
      tint: "#EEE2DE",
      selected: "#F3D4C4",
      border: "#E0CFC7",
      surface: "#F7F1EE",
      elevatedSurface: "#FFFFFF",
      background: "#EEE2DE",
      backgroundGradient: ["#EEE2DE", "#F7F1EE"],
      card: "#FFFFFF",
      text: "#2B2A4C",
      textSecondary: "#3F3E63",
      textMuted: "#6B6A8A",
      chartPalette: ["#B31312", "#EA906C", "#2B2A4C", "#EEE2DE", "#8F0F0E"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#EA906C",
      accentHover: "#F0A888",
      secondaryAccent: "#B31312",
      tint: "#35345A",
      selected: "#3F3E6A",
      border: "#45446A",
      surface: "#32314F",
      elevatedSurface: "#3A395A",
      background: "#2B2A4C",
      backgroundGradient: ["#2B2A4C", "#32314F"],
      card: "#32314F",
      text: "#EEE2DE",
      textSecondary: "#E0CFC7",
      textMuted: "#B8A9A3",
      chartPalette: ["#EA906C", "#B31312", "#EEE2DE", "#F0A888", "#8F0F0E"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "pvamu-purple",
    name: "PVAMU Purple",
    tagline: "Prairie View A&M · panther purple",
    light: {
      accent: "#4F2D7F",
      accentHover: "#3D2363",
      secondaryAccent: "#FFB81C",
      tint: "#F5F0FA",
      selected: "#EDE4F7",
      border: "#DDD0EF",
      surface: "#FFFFFF",
      elevatedSurface: "#FFFFFF",
      background: "#FAF8FC",
      backgroundGradient: ["#FFFFFF", "#F5F0FA"],
      card: "#FFFFFF",
      text: "#1E1033",
      textSecondary: "#57534E",
      textMuted: "#78716C",
      chartPalette: ["#4F2D7F", "#FFB81C", "#7C3AED", "#34C759", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#9B6FD4",
      accentHover: "#B794E8",
      secondaryAccent: "#FFB81C",
      tint: "#2A1845",
      selected: "#3D2363",
      border: "#3F2E5C",
      surface: "#16101F",
      elevatedSurface: "#1F1630",
      background: "#0D0814",
      backgroundGradient: ["#0D0814", "#16101F"],
      card: "#16101F",
      text: "#FAF5FF",
      textSecondary: "#D6D3D1",
      textMuted: "#A8A29E",
      chartPalette: ["#9B6FD4", "#FFB81C", "#C4B5FD", "#34D399", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "pvamu-gold",
    name: "PVAMU Gold",
    tagline: "Prairie View A&M · gold & purple",
    light: {
      accent: "#FFB81C",
      accentHover: "#E5A519",
      secondaryAccent: "#4F2D7F",
      tint: "#FFFBEB",
      selected: "#FEF3C7",
      border: "#FDE68A",
      surface: "#FFFFFF",
      elevatedSurface: "#FFFFFF",
      background: "#FFFDF7",
      backgroundGradient: ["#FFFFFF", "#FFFBEB"],
      card: "#FFFFFF",
      text: "#1C1917",
      textSecondary: "#57534E",
      textMuted: "#78716C",
      chartPalette: ["#FFB81C", "#4F2D7F", "#F59E0B", "#34C759", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#FFC94D",
      accentHover: "#FFD970",
      secondaryAccent: "#9B6FD4",
      tint: "#422006",
      selected: "#78350F",
      border: "#3D2E14",
      surface: "#1A1510",
      elevatedSurface: "#241C14",
      background: "#0F0C09",
      backgroundGradient: ["#0F0C09", "#1A1510"],
      card: "#1A1510",
      text: "#FAFAF9",
      textSecondary: "#D6D3D1",
      textMuted: "#A8A29E",
      chartPalette: ["#FFC94D", "#9B6FD4", "#F59E0B", "#34D399", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "moss-night",
    name: "Moss Night",
    tagline: "Verdant · always dark",
    forceDark: true,
    light: {
      accent: "#34D399",
      accentHover: "#6EE7B7",
      tint: "#064E3B",
      selected: "#065F46",
      border: "#1F3A32",
      surface: "#121A17",
      elevatedSurface: "#1A2620",
      background: "#0A100E",
      backgroundGradient: ["#070C0A", "#121A17"],
      card: "#121A17",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      chartPalette: ["#34D399", "#6EE7B7", "#10B981", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#34D399",
      accentHover: "#6EE7B7",
      tint: "#064E3B",
      selected: "#065F46",
      border: "#1F3A32",
      surface: "#121A17",
      elevatedSurface: "#1A2620",
      background: "#0A100E",
      backgroundGradient: ["#070C0A", "#121A17"],
      card: "#121A17",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      chartPalette: ["#34D399", "#6EE7B7", "#10B981", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "ember-forge",
    name: "Ember Forge",
    tagline: "Warm flame · always dark",
    forceDark: true,
    light: {
      accent: "#F97316",
      accentHover: "#FB923C",
      secondaryAccent: "#FB7185",
      tint: "#7C2D12",
      selected: "#9A3412",
      border: "#3F2418",
      surface: "#1A1210",
      elevatedSurface: "#241816",
      background: "#0F0A08",
      backgroundGradient: ["#0A0706", "#1A1210"],
      card: "#1A1210",
      text: "#FAFAF9",
      textSecondary: "#D6D3D1",
      textMuted: "#A8A29E",
      chartPalette: ["#F97316", "#FB923C", "#FBBF24", "#34D399", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#F97316",
      accentHover: "#FB923C",
      secondaryAccent: "#FB7185",
      tint: "#7C2D12",
      selected: "#9A3412",
      border: "#3F2418",
      surface: "#1A1210",
      elevatedSurface: "#241816",
      background: "#0F0A08",
      backgroundGradient: ["#0A0706", "#1A1210"],
      card: "#1A1210",
      text: "#FAFAF9",
      textSecondary: "#D6D3D1",
      textMuted: "#A8A29E",
      chartPalette: ["#F97316", "#FB923C", "#FBBF24", "#34D399", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "bronze-dark",
    name: "Bronze Dark",
    tagline: "Copper metal · always dark",
    forceDark: true,
    light: {
      accent: "#D97706",
      accentHover: "#F59E0B",
      secondaryAccent: "#B45309",
      tint: "#78350F",
      selected: "#92400E",
      border: "#3D2E14",
      surface: "#1A1510",
      elevatedSurface: "#241C14",
      background: "#0C0A07",
      backgroundGradient: ["#080604", "#1A1510"],
      card: "#1A1510",
      text: "#FAFAF9",
      textSecondary: "#D6D3D1",
      textMuted: "#A8A29E",
      chartPalette: ["#D97706", "#F59E0B", "#FBBF24", "#34D399", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#D97706",
      accentHover: "#F59E0B",
      secondaryAccent: "#B45309",
      tint: "#78350F",
      selected: "#92400E",
      border: "#3D2E14",
      surface: "#1A1510",
      elevatedSurface: "#241C14",
      background: "#0C0A07",
      backgroundGradient: ["#080604", "#1A1510"],
      card: "#1A1510",
      text: "#FAFAF9",
      textSecondary: "#D6D3D1",
      textMuted: "#A8A29E",
      chartPalette: ["#D97706", "#F59E0B", "#FBBF24", "#34D399", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "garnet-night",
    name: "Garnet Night",
    tagline: "Deep crimson · always dark",
    forceDark: true,
    light: {
      accent: "#E11D48",
      accentHover: "#FB7185",
      secondaryAccent: "#BE123C",
      tint: "#4C0519",
      selected: "#881337",
      border: "#3F1724",
      surface: "#160E12",
      elevatedSurface: "#221019",
      background: "#0A0608",
      backgroundGradient: ["#060304", "#160E12"],
      card: "#160E12",
      text: "#F8FAFC",
      textSecondary: "#CBD5E1",
      textMuted: "#94A3B8",
      chartPalette: ["#E11D48", "#FB7185", "#BE123C", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#E11D48",
      accentHover: "#FB7185",
      secondaryAccent: "#BE123C",
      tint: "#4C0519",
      selected: "#881337",
      border: "#3F1724",
      surface: "#160E12",
      elevatedSurface: "#221019",
      background: "#0A0608",
      backgroundGradient: ["#060304", "#160E12"],
      card: "#160E12",
      text: "#F8FAFC",
      textSecondary: "#CBD5E1",
      textMuted: "#94A3B8",
      chartPalette: ["#E11D48", "#FB7185", "#BE123C", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
  {
    id: "gunmetal",
    name: "Gunmetal",
    tagline: "Quiet steel · always dark",
    forceDark: true,
    light: {
      accent: "#94A3B8",
      accentHover: "#CBD5E1",
      tint: "#1E293B",
      selected: "#334155",
      border: "#2D3138",
      surface: "#15181C",
      elevatedSurface: "#1C2128",
      background: "#0B0D10",
      backgroundGradient: ["#08090B", "#15181C"],
      card: "#15181C",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      chartPalette: ["#94A3B8", "#CBD5E1", "#64748B", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
    dark: {
      accent: "#94A3B8",
      accentHover: "#CBD5E1",
      tint: "#1E293B",
      selected: "#334155",
      border: "#2D3138",
      surface: "#15181C",
      elevatedSurface: "#1C2128",
      background: "#0B0D10",
      backgroundGradient: ["#08090B", "#15181C"],
      card: "#15181C",
      text: "#F5F7FA",
      textSecondary: "#98A2B3",
      textMuted: "#667085",
      chartPalette: ["#94A3B8", "#CBD5E1", "#64748B", "#FF9F0A", "#FF453A"],
      ...SHARED_SUCCESS,
    },
  },
]

export const THEME_CATALOG = Object.fromEntries(
  THEME_DEFINITIONS.map((def) => [def.id, def]),
) as Record<ThemeId, ThemeDefinition>

export const DEFAULT_THEME_ID: ThemeId = "apple-lavender"
export const DEFAULT_APPEARANCE_MODE: AppearanceMode = "system"

const DARK_FIRST_THEME_IDS: ThemeId[] = [
  "midnight",
  "graphite-dark",
  "carbon",
  "obsidian-glass",
  "moss-night",
  "ember-forge",
  "bronze-dark",
  "garnet-night",
  "gunmetal",
]

export function themeIsDarkFirst(themeId: ThemeId): boolean {
  return Boolean(THEME_CATALOG[themeId]?.forceDark)
}

/** @deprecated Use themeIsDarkFirst */
export function themePrefersDarkInSystemMode(themeId: ThemeId): boolean {
  return themeIsDarkFirst(themeId)
}

export function darkFirstThemeNames(): string {
  return DARK_FIRST_THEME_IDS.map((id) => THEME_CATALOG[id]?.name ?? id).join(", ")
}

export function resolveThemeTokens(
  themeId: ThemeId,
  appearanceMode: AppearanceMode,
  systemScheme: "light" | "dark" | null,
): AppThemeTokens {
  const def = THEME_CATALOG[themeId] ?? THEME_CATALOG[DEFAULT_THEME_ID]

  if (def.forceDark) {
    return buildTokens(def, { ...def.dark, isDark: true })
  }

  let useDark: boolean
  if (appearanceMode === "light") {
    useDark = false
  } else if (appearanceMode === "dark") {
    useDark = true
  } else {
    useDark = systemScheme === "dark"
  }

  const raw = useDark ? def.dark : def.light
  return buildTokens(def, { ...raw, isDark: useDark })
}

/** Theme picker previews — same resolver so dark-first themes stay dark in the grid. */
export function resolveThemePreviewTokens(
  themeId: ThemeId,
  appearanceMode: AppearanceMode,
  systemScheme: "light" | "dark" | null,
): AppThemeTokens {
  return resolveThemeTokens(themeId, appearanceMode, systemScheme)
}

export function getThemeLabel(themeId: ThemeId): string {
  return THEME_CATALOG[themeId]?.name ?? themeId
}

export function getAppearanceModeLabel(mode: AppearanceMode): string {
  if (mode === "light") return "Light"
  if (mode === "dark") return "Dark"
  return "System"
}
