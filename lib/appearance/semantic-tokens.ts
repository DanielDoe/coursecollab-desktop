/**
 * Enterprise semantic design tokens (v2).
 *
 * Theme → semantic palette → CSS variables → component recipes → UI
 *
 * Module developers consume tokens via themeFromSemantic() / getStudentModuleTheme()
 * — never hard-code accent colors.
 */

import type { AppThemeTokens } from "@/lib/appearance/app-themes"
import { hexToRgba } from "@/lib/appearance/app-themes"
import {
  DEFAULT_SEMANTIC_PALETTE_ID,
  resolveModuleHuesForPalette,
  type SemanticPaletteId,
} from "@/lib/appearance/semantic-palettes"

function clampChannel(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function adjustHex(hex: string, amount: number): string {
  const normalized = hex.replace("#", "")
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized
  const r = clampChannel(parseInt(full.slice(0, 2), 16) + amount)
  const g = clampChannel(parseInt(full.slice(2, 4), 16) + amount)
  const b = clampChannel(parseInt(full.slice(4, 6), 16) + amount)
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

/** Semantic roles — stable across all brand themes */
export type SemanticRole =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "reward"
  | "homework"
  | "attendance"
  | "quiz"
  | "codebench"
  | "ai"
  | "analytics"
  | "calendar"
  | "messages"
  | "projects"
  | "discussion"
  | "practice"
  | "neutral"

export type SemanticColorSet = {
  base: string
  hover: string
  soft: string
  border: string
  text: string
  glow: string
}

export type SemanticPalette = Record<SemanticRole, SemanticColorSet>

const ALL_ROLES: SemanticRole[] = [
  "primary",
  "secondary",
  "success",
  "warning",
  "danger",
  "info",
  "reward",
  "homework",
  "attendance",
  "quiz",
  "codebench",
  "ai",
  "analytics",
  "calendar",
  "messages",
  "projects",
  "discussion",
  "practice",
  "neutral",
]

/** Module/feature hues — default Vivid Spectrum; overridden by semantic palette choice */
const MODULE_BASE: Partial<Record<SemanticRole, string>> = {
  homework: "#F97316",
  attendance: "#38BDF8",
  quiz: "#9333EA",
  codebench: "#6366F1",
  ai: "#06B6D4",
  analytics: "#EC4899",
  calendar: "#0284C7",
  messages: "#0D9488",
  discussion: "#14B8A6",
  reward: "#EAB308",
  projects: "#7C3AED",
  practice: "#16A34A",
  info: "#2563EB",
  neutral: "#64748B",
}

function resolveModuleBase(
  role: SemanticRole,
  moduleHues: Partial<Record<SemanticRole, string>>,
): string | undefined {
  return moduleHues[role] ?? MODULE_BASE[role]
}

function resolveBase(
  role: SemanticRole,
  tokens: AppThemeTokens,
  moduleHues: Partial<Record<SemanticRole, string>>,
): string {
  switch (role) {
    case "primary":
      return tokens.accent
    case "secondary":
      return tokens.secondaryAccent
    case "success":
      return tokens.success
    case "warning":
      return tokens.warning
    case "danger":
      return tokens.danger
    case "quiz":
      return tokens.chartPalette[0] ?? resolveModuleBase(role, moduleHues) ?? tokens.accent
    default:
      return resolveModuleBase(role, moduleHues) ?? tokens.accent
  }
}

/** Build one semantic color set with restrained dark-mode tuning (Apple / Raycast style) */
export function buildSemanticColorSet(base: string, isDark: boolean): SemanticColorSet {
  const hover = isDark ? adjustHex(base, 18) : adjustHex(base, -14)
  const text = isDark ? adjustHex(base, 55) : adjustHex(base, -8)
  const softAlpha = isDark ? 0.16 : 0.11
  const borderAlpha = isDark ? 0.32 : 0.2
  const glowAlpha = isDark ? 0.28 : 0.12

  return {
    base,
    hover,
    soft: hexToRgba(base, softAlpha),
    border: hexToRgba(base, borderAlpha),
    text,
    glow: hexToRgba(base, glowAlpha),
  }
}

/** Generate full semantic palette for the active brand theme + chosen semantic scheme */
export function buildSemanticPalette(
  tokens: AppThemeTokens,
  paletteId: SemanticPaletteId = DEFAULT_SEMANTIC_PALETTE_ID,
): SemanticPalette {
  const moduleHues = resolveModuleHuesForPalette(paletteId)
  const palette = {} as SemanticPalette
  for (const role of ALL_ROLES) {
    palette[role] = buildSemanticColorSet(resolveBase(role, tokens, moduleHues), tokens.isDark)
  }
  return palette
}

const CSS_PREFIX = "--cc-sem"

export function semanticCssVar(role: SemanticRole, key: keyof SemanticColorSet = "base"): string {
  return key === "base" ? `var(${CSS_PREFIX}-${role})` : `var(${CSS_PREFIX}-${role}-${key})`
}

/** Read whether layer-2 semantic colors are active (client only; default false). */
export function getSemanticColorsEnabled(): boolean {
  if (typeof document === "undefined") return false
  return document.documentElement.dataset.ccSemanticColors === "true"
}

/** Map every semantic token to the brand accent — classic single-color UI */
export function applyAccentAliasSemanticTokens(root: HTMLElement, tokens: AppThemeTokens): void {
  const unified = buildSemanticColorSet(tokens.accent, tokens.isDark)
  for (const role of ALL_ROLES) {
    root.style.setProperty(`${CSS_PREFIX}-${role}`, unified.base)
    root.style.setProperty(`${CSS_PREFIX}-${role}-hover`, tokens.accentHover)
    root.style.setProperty(`${CSS_PREFIX}-${role}-soft`, tokens.accentSoft)
    root.style.setProperty(`${CSS_PREFIX}-${role}-border`, tokens.accentBorder)
    root.style.setProperty(`${CSS_PREFIX}-${role}-text`, tokens.accentDark)
    root.style.setProperty(`${CSS_PREFIX}-${role}-glow`, hexToRgba(tokens.accent, tokens.isDark ? 0.28 : 0.12))
  }
  const accentCharts = tokens.accent
  for (let i = 1; i <= 8; i++) {
    root.style.setProperty(`--cc-chart-${i}`, accentCharts)
  }
}

/** Inject semantic CSS variables on :root (called from applyWebTheme) */
export function applySemanticTokens(root: HTMLElement, palette: SemanticPalette): void {
  for (const role of ALL_ROLES) {
    const set = palette[role]
    root.style.setProperty(`${CSS_PREFIX}-${role}`, set.base)
    root.style.setProperty(`${CSS_PREFIX}-${role}-hover`, set.hover)
    root.style.setProperty(`${CSS_PREFIX}-${role}-soft`, set.soft)
    root.style.setProperty(`${CSS_PREFIX}-${role}-border`, set.border)
    root.style.setProperty(`${CSS_PREFIX}-${role}-text`, set.text)
    root.style.setProperty(`${CSS_PREFIX}-${role}-glow`, set.glow)
  }

  const chartSeries = [
    palette.primary.base,
    palette.quiz.base,
    palette.homework.base,
    palette.attendance.base,
    palette.practice.base,
    palette.discussion.base,
    palette.ai.base,
    palette.analytics.base,
  ]
  root.style.setProperty("--cc-chart-1", chartSeries[0]!)
  root.style.setProperty("--cc-chart-2", chartSeries[1]!)
  root.style.setProperty("--cc-chart-3", chartSeries[2]!)
  root.style.setProperty("--cc-chart-4", chartSeries[3]!)
  root.style.setProperty("--cc-chart-5", chartSeries[4]!)
  root.style.setProperty("--cc-chart-6", chartSeries[5]!)
  root.style.setProperty("--cc-chart-7", chartSeries[6]!)
  root.style.setProperty("--cc-chart-8", chartSeries[7]!)
}

/** Default chart palette for SSR / stories */
export const DEFAULT_CHART_SEMANTIC = [
  "#6D5EF6",
  "#8B5CF6",
  "#FB923C",
  "#38BDF8",
  "#22C55E",
  "#14B8A6",
  "#6366F1",
  "#EC4899",
] as const
