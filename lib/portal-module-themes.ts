/** Shared accent color tokens for all CourseCollab portals (student, faculty, guest, summer camp). */

import type { SemanticRole } from "@/lib/appearance/semantic-tokens"
import { resolveFamilySemanticRole } from "@/lib/appearance/module-semantic-map"
import {
  semanticNavIconActive,
  semanticNavIconIdle,
  semanticNavLinkActive,
  semanticNavLinkIdle,
  semanticOutline,
  semanticPageTokens,
} from "@/lib/appearance/component-recipes"

export type PortalColorFamily =
  | "brand"
  | "sky"
  | "amber"
  | "violet"
  | "blue"
  | "purple"
  | "indigo"
  | "teal"
  | "rose"
  | "emerald"
  | "orange"
  | "slate"

export type PortalModuleThemeTokens = {
  family: PortalColorFamily
  semantic: SemanticRole
  sidebar: { link: string; icon: string }
  page: {
    iconBg: string
    iconText: string
    tabActive: string
    badge: string
    softBg: string
    border: string
    spinner: string
    progress: string
    cta: string
    switchChecked: string
    slider: string
  }
}

/** Appearance-driven tokens — all module families resolve to selected theme CSS vars. */
const APPEARANCE_SIDEBAR: PortalSidebarTheme = {
  link: "bg-[var(--cc-drawer-nav-active-bg)] text-[var(--cc-drawer-primary)] border border-[var(--cc-drawer-nav-active-border)]",
  icon: "bg-[var(--pv-sidebar-active-icon-bg)] text-[var(--cc-drawer-primary)]",
}

const APPEARANCE_PAGE = {
  iconBg: "bg-[var(--cc-accent-soft)]",
  iconText: "text-[var(--cc-accent-dark)]",
  tabActive:
    "data-[state=active]:bg-[var(--cc-accent-soft)] data-[state=active]:text-[var(--cc-accent-dark)]",
  badge: "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]",
  softBg: "bg-[var(--cc-accent-soft)]",
  border: "border-[var(--cc-accent-border)]",
  spinner: "border-t-[var(--cc-accent)]",
  cta: "bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white",
  switchChecked: "data-[state=checked]:bg-[var(--cc-accent)]",
  slider:
    "[&_[data-slot=slider-range]]:bg-[var(--cc-accent)] [&_[data-slot=slider-thumb]]:border-[var(--cc-accent)]",
}

const APPEARANCE_OUTLINE_BTN =
  "border-[var(--cc-accent-border)] text-[var(--cc-accent-dark)] hover:bg-[var(--cc-accent-soft)]"

const APPEARANCE_PROGRESS_FILL = "bg-[var(--cc-accent)]"

/** @deprecated Legacy per-family tokens — kept for reference; themeFromFamily uses appearance vars. */
const FAMILY_TOKENS: Record<
  PortalColorFamily,
  {
    sidebar: PortalSidebarTheme
    page: Pick<
      PortalModuleThemeTokens["page"],
      "iconBg" | "iconText" | "tabActive" | "badge" | "softBg" | "border" | "spinner"
    >
  }
> = {
  brand: {
    sidebar: {
      link: "bg-[#582c83]/10 dark:bg-[#7a4eba]/15 text-[#582c83] dark:text-[#b8a0e0]",
      icon: "bg-[#582c83]/15 dark:bg-[#7a4eba]/25 text-[#582c83] dark:text-[#b8a0e0]",
    },
    page: {
      iconBg: "bg-[#582c83]/15 dark:bg-[#7a4eba]/25",
      iconText: "text-[#582c83] dark:text-[#b8a0e0]",
      tabActive:
        "data-[state=active]:bg-[#582c83]/10 dark:data-[state=active]:bg-[#7a4eba]/20 data-[state=active]:text-[#582c83] dark:data-[state=active]:text-[#b8a0e0]",
      badge: "bg-[#582c83]/15 text-[#582c83] dark:bg-[#7a4eba]/25 dark:text-[#b8a0e0]",
      softBg: "bg-[#582c83]/10 dark:bg-[#7a4eba]/15",
      border: "border-[#582c83]/20 dark:border-[#7a4eba]/30",
      spinner: "border-t-[#582c83] dark:border-t-[#b8a0e0]",
    },
  },
  sky: {
    sidebar: {
      link: "bg-sky-500/10 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300",
      icon: "bg-sky-500/15 dark:bg-sky-500/25 text-sky-600 dark:text-sky-400",
    },
    page: {
      iconBg: "bg-sky-500/15 dark:bg-sky-500/25",
      iconText: "text-sky-600 dark:text-sky-400",
      tabActive:
        "data-[state=active]:bg-sky-500/10 dark:data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-700 dark:data-[state=active]:text-sky-300",
      badge: "bg-sky-500/15 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300",
      softBg: "bg-sky-500/10 dark:bg-sky-500/15",
      border: "border-sky-500/20 dark:border-sky-500/30",
      spinner: "border-t-sky-600 dark:border-t-sky-400",
    },
  },
  amber: {
    sidebar: {
      link: "bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300",
      icon: "bg-amber-500/15 dark:bg-amber-500/25 text-amber-600 dark:text-amber-400",
    },
    page: {
      iconBg: "bg-amber-500/15 dark:bg-amber-500/25",
      iconText: "text-amber-600 dark:text-amber-400",
      tabActive:
        "data-[state=active]:bg-amber-500/10 dark:data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-300",
      badge: "bg-amber-500/15 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300",
      softBg: "bg-amber-500/10 dark:bg-amber-500/15",
      border: "border-amber-500/20 dark:border-amber-500/30",
      spinner: "border-t-amber-600 dark:border-t-amber-400",
    },
  },
  violet: {
    sidebar: {
      link: "bg-violet-500/10 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300",
      icon: "bg-violet-500/15 dark:bg-violet-500/25 text-violet-600 dark:text-violet-400",
    },
    page: {
      iconBg: "bg-violet-500/15 dark:bg-violet-500/25",
      iconText: "text-violet-600 dark:text-violet-400",
      tabActive:
        "data-[state=active]:bg-violet-500/10 dark:data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-300",
      badge: "bg-violet-500/15 text-violet-700 dark:bg-violet-500/25 dark:text-violet-300",
      softBg: "bg-violet-500/10 dark:bg-violet-500/15",
      border: "border-violet-500/20 dark:border-violet-500/30",
      spinner: "border-t-violet-600 dark:border-t-violet-400",
    },
  },
  blue: {
    sidebar: {
      link: "bg-blue-500/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300",
      icon: "bg-blue-500/15 dark:bg-blue-500/25 text-blue-600 dark:text-blue-400",
    },
    page: {
      iconBg: "bg-blue-500/15 dark:bg-blue-500/25",
      iconText: "text-blue-600 dark:text-blue-400",
      tabActive:
        "data-[state=active]:bg-blue-500/10 dark:data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300",
      badge: "bg-blue-500/15 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300",
      softBg: "bg-blue-500/10 dark:bg-blue-500/15",
      border: "border-blue-500/20 dark:border-blue-500/30",
      spinner: "border-t-blue-600 dark:border-t-blue-400",
    },
  },
  purple: {
    sidebar: {
      link: "bg-purple-500/10 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300",
      icon: "bg-purple-500/15 dark:bg-purple-500/25 text-purple-600 dark:text-purple-400",
    },
    page: {
      iconBg: "bg-purple-500/15 dark:bg-purple-500/25",
      iconText: "text-purple-600 dark:text-purple-400",
      tabActive:
        "data-[state=active]:bg-purple-500/10 dark:data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300",
      badge: "bg-purple-500/15 text-purple-700 dark:bg-purple-500/25 dark:text-purple-300",
      softBg: "bg-purple-500/10 dark:bg-purple-500/15",
      border: "border-purple-500/20 dark:border-purple-500/30",
      spinner: "border-t-purple-600 dark:border-t-purple-400",
    },
  },
  indigo: {
    sidebar: {
      link: "bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
      icon: "bg-indigo-500/15 dark:bg-indigo-500/25 text-indigo-600 dark:text-indigo-400",
    },
    page: {
      iconBg: "bg-indigo-500/15 dark:bg-indigo-500/25",
      iconText: "text-indigo-600 dark:text-indigo-400",
      tabActive:
        "data-[state=active]:bg-indigo-500/10 dark:data-[state=active]:bg-indigo-500/20 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300",
      badge: "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-300",
      softBg: "bg-indigo-500/10 dark:bg-indigo-500/15",
      border: "border-indigo-500/20 dark:border-indigo-500/30",
      spinner: "border-t-indigo-600 dark:border-t-indigo-400",
    },
  },
  teal: {
    sidebar: {
      link: "bg-teal-500/10 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300",
      icon: "bg-teal-500/15 dark:bg-teal-500/25 text-teal-600 dark:text-teal-400",
    },
    page: {
      iconBg: "bg-teal-500/15 dark:bg-teal-500/25",
      iconText: "text-teal-600 dark:text-teal-400",
      tabActive:
        "data-[state=active]:bg-teal-500/10 dark:data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-700 dark:data-[state=active]:text-teal-300",
      badge: "bg-teal-500/15 text-teal-700 dark:bg-teal-500/25 dark:text-teal-300",
      softBg: "bg-teal-500/10 dark:bg-teal-500/15",
      border: "border-teal-500/20 dark:border-teal-500/30",
      spinner: "border-t-teal-600 dark:border-t-teal-400",
    },
  },
  rose: {
    sidebar: {
      link: "bg-rose-500/10 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300",
      icon: "bg-rose-500/15 dark:bg-rose-500/25 text-rose-600 dark:text-rose-400",
    },
    page: {
      iconBg: "bg-rose-500/15 dark:bg-rose-500/25",
      iconText: "text-rose-600 dark:text-rose-400",
      tabActive:
        "data-[state=active]:bg-rose-500/10 dark:data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-700 dark:data-[state=active]:text-rose-300",
      badge: "bg-rose-500/15 text-rose-700 dark:bg-rose-500/25 dark:text-rose-300",
      softBg: "bg-rose-500/10 dark:bg-rose-500/15",
      border: "border-rose-500/20 dark:border-rose-500/30",
      spinner: "border-t-rose-600 dark:border-t-rose-400",
    },
  },
  emerald: {
    sidebar: {
      link: "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      icon: "bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400",
    },
    page: {
      iconBg: "bg-emerald-500/15 dark:bg-emerald-500/25",
      iconText: "text-emerald-600 dark:text-emerald-400",
      tabActive:
        "data-[state=active]:bg-emerald-500/10 dark:data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300",
      badge: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300",
      softBg: "bg-emerald-500/10 dark:bg-emerald-500/15",
      border: "border-emerald-500/20 dark:border-emerald-500/30",
      spinner: "border-t-emerald-600 dark:border-t-emerald-400",
    },
  },
  orange: {
    sidebar: {
      link: "bg-orange-500/10 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300",
      icon: "bg-orange-500/15 dark:bg-orange-500/25 text-orange-600 dark:text-orange-400",
    },
    page: {
      iconBg: "bg-orange-500/15 dark:bg-orange-500/25",
      iconText: "text-orange-600 dark:text-orange-400",
      tabActive:
        "data-[state=active]:bg-orange-500/10 dark:data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-700 dark:data-[state=active]:text-orange-300",
      badge: "bg-orange-500/15 text-orange-700 dark:bg-orange-500/25 dark:text-orange-300",
      softBg: "bg-orange-500/10 dark:bg-orange-500/15",
      border: "border-orange-500/20 dark:border-orange-500/30",
      spinner: "border-t-orange-600 dark:border-t-orange-400",
    },
  },
  slate: {
    sidebar: {
      link: "bg-slate-600/10 dark:bg-slate-400/15 text-slate-700 dark:text-slate-300",
      icon: "bg-slate-600/15 dark:bg-slate-400/20 text-slate-600 dark:text-slate-400",
    },
    page: {
      iconBg: "bg-slate-600/15 dark:bg-slate-400/20",
      iconText: "text-slate-600 dark:text-slate-400",
      tabActive:
        "data-[state=active]:bg-slate-600/10 dark:data-[state=active]:bg-slate-400/15 data-[state=active]:text-slate-700 dark:data-[state=active]:text-slate-300",
      badge: "bg-slate-600/15 text-slate-700 dark:bg-slate-400/20 dark:text-slate-300",
      softBg: "bg-slate-600/10 dark:bg-slate-400/15",
      border: "border-slate-500/20 dark:border-slate-400/30",
      spinner: "border-t-slate-600 dark:border-t-slate-400",
    },
  },
}


/**
 * Neighbor families for content lists — grouped by hue proximity
 * (Appearance picker sections + portal families). Chrome (CTA / selected)
 * stays on the module group; list rows/icons may cycle these.
 */
export const PORTAL_FAMILY_NEIGHBORS: Record<PortalColorFamily, readonly PortalColorFamily[]> = {
  brand: ["brand", "purple", "violet", "indigo"],
  purple: ["purple", "violet", "indigo", "brand"],
  violet: ["violet", "purple", "indigo", "rose"],
  indigo: ["indigo", "blue", "violet", "purple"],
  blue: ["blue", "emerald", "amber", "indigo"],
  sky: ["sky", "blue", "teal", "emerald"],
  teal: ["teal", "sky", "emerald", "blue"],
  emerald: ["emerald", "teal", "sky", "amber"],
  amber: ["amber", "orange", "emerald", "rose"],
  orange: ["orange", "amber", "rose", "emerald"],
  rose: ["rose", "orange", "violet", "amber"],
  slate: ["slate", "blue", "indigo", "teal"],
}

export type PortalListStripe = {
  family: PortalColorFamily
  row: string
  iconBg: string
  iconText: string
  border: string
}

/** Theme-tinted list rows — follows `--cc-accent`, not a hardcoded blue/gray family. */
export function portalThemeStripe(index: number): PortalListStripe {
  const even = index % 2 === 0
  return {
    family: "brand",
    row: even ? "bg-[var(--muted)]" : "bg-[var(--card)]",
    iconBg: "bg-[var(--cc-accent)]",
    iconText: "!text-white",
    border: "border-[var(--border)]",
  }
}

/** Alternating list/icon tints from families near `anchor`. Prefer `portalThemeStripe` on themed portals. */
export function portalListStripe(index: number, anchor: PortalColorFamily = "blue"): PortalListStripe {
  const cycle = PORTAL_FAMILY_NEIGHBORS[anchor]
  const family = cycle[index % cycle.length] ?? anchor
  const page = FAMILY_TOKENS[family].page
  return {
    family,
    row: page.iconBg,
    iconBg: page.iconBg,
    iconText: page.iconText,
    border: page.border,
  }
}

/** Solid action fills — white label, readable in light and dark. Never use soft/translucent washes on buttons.
 *  Do not add `dark:text-white` — appearance remaps that class to `--cc-text` (dark gray on light). */
export const PORTAL_FAMILY_SOLID: Record<PortalColorFamily, string> = {
  brand: "bg-[#582c83] !text-white hover:bg-[#4a226e] dark:bg-[#8b6cc9] dark:hover:bg-[#7a5bb8]",
  sky: "bg-sky-600 !text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600",
  amber: "bg-amber-600 !text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600",
  violet: "bg-violet-600 !text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600",
  blue: "bg-blue-600 !text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600",
  purple: "bg-purple-600 !text-white hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600",
  indigo: "bg-indigo-600 !text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600",
  teal: "bg-teal-600 !text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600",
  rose: "bg-rose-600 !text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600",
  emerald: "bg-emerald-600 !text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600",
  orange: "bg-orange-600 !text-white hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600",
  slate: "bg-slate-700 !text-white hover:bg-slate-800 dark:bg-slate-500 dark:hover:bg-slate-600",
}

export function portalSolidButton(family: PortalColorFamily = "blue"): string {
  return PORTAL_FAMILY_SOLID[family]
}

export function portalSolidButtonAt(index: number, anchor: PortalColorFamily = "blue"): string {
  const cycle = PORTAL_FAMILY_NEIGHBORS[anchor]
  return portalSolidButton(cycle[index % cycle.length] ?? anchor)
}

export const PORTAL_DEFAULT_FAMILY: PortalColorFamily = 'brand';

export type PortalSidebarTheme = { link: string; icon: string };

/** Build module theme from a semantic role (preferred) */
export function themeFromSemantic(role: SemanticRole, family: PortalColorFamily = "brand"): PortalModuleThemeTokens {
  const page = semanticPageTokens(role)
  return {
    family,
    semantic: role,
    sidebar: {
      link: semanticNavLinkActive(),
      icon: semanticNavIconIdle(role),
    },
    page,
  }
}

/** @deprecated Use themeFromSemantic — kept for family-based call sites */
export function themeFromFamily(family: PortalColorFamily): PortalModuleThemeTokens {
  const role = resolveFamilySemanticRole(family)
  return themeFromSemantic(role, family)
}

/** Sidebar helpers for per-item semantic idle icons */
export function portalNavIconIdle(role: SemanticRole): string {
  return semanticNavIconIdle(role)
}

export function portalNavIconActive(): string {
  return semanticNavIconActive()
}

export function portalNavLinkActive(): string {
  return semanticNavLinkActive()
}

export function portalNavLinkIdle(): string {
  return semanticNavLinkIdle()
}

export function themeFromFamilyLegacy(family: PortalColorFamily): PortalModuleThemeTokens {
  return themeFromFamily(family)
}

export function portalIconBadgeClass(theme: PortalModuleThemeTokens, size: 'sm' | 'md' = 'md'): string {
  const sizeClass = size === 'sm' ? 'size-10 rounded-xl' : 'size-12 rounded-2xl';
  return `${sizeClass} flex items-center justify-center ${theme.page.iconBg} ${theme.page.iconText}`;
}

export function portalBreadcrumbClass(theme: PortalModuleThemeTokens): string {
  return `${theme.page.softBg} ${theme.page.iconText} border ${theme.page.border} shadow-sm`;
}

/** Segmented view toggles (grid/list) — active pill must stay readable in dark mode */
export function portalViewOrganizerContainerClass(): string {
  return "flex items-center gap-0.5 p-0.5 rounded-full bg-[var(--sidebar-accent)]/50 shrink-0"
}

export function portalViewOrganizerActiveClass(theme: PortalModuleThemeTokens): string {
  // Soft fill + accent ink — never solid primary (icon vanishes on purple).
  return [
    "rounded-full h-8 w-8 transition-all shadow-none",
    theme.page.softBg,
    theme.page.iconText,
    // Override Button ghost hover:bg-muted / default primary-hover
    "hover:!bg-[var(--cc-accent-soft)] hover:!text-[var(--cc-accent-dark)]",
  ].join(" ")
}

export function portalViewOrganizerInactiveClass(): string {
  // Neutral muted hover — readable on Apple Lavender; icon stays dark.
  return "rounded-full h-8 w-8 transition-all text-[var(--cc-text-secondary)] hover:!text-[var(--cc-text)] hover:!bg-[var(--muted)]"
}

/** Inline accent icon on dark cards (Clock, Bell, Sparkles, etc.) */
export function portalAccentIconClass(theme: PortalModuleThemeTokens): string {
  return theme.page.iconText
}

/** Status chip — e.g. "In Progress" */
export function portalStatusBadgeClass(theme: PortalModuleThemeTokens): string {
  return theme.page.badge
}

/** Secondary outline action — AI Notes, filters */
export function portalOutlineButtonClass(theme: PortalModuleThemeTokens): string {
  return semanticOutline(theme.semantic)
}

/** Selected/toggled outline control */
export function portalSelectedOutlineClass(theme: PortalModuleThemeTokens): string {
  return `${theme.page.border} ${theme.page.softBg} ${theme.page.iconText}`
}

/** Progress bar fill */
export function portalProgressFillClass(theme: PortalModuleThemeTokens): string {
  return theme.page.progress
}

/** Radix Switch — module semantic checked track */
export function portalSwitchCheckedClass(theme: PortalModuleThemeTokens): string {
  return `shrink-0 ${theme.page.switchChecked}`
}

/** Slider range + thumb — module semantic accent */
export function portalSliderClass(theme: PortalModuleThemeTokens): string {
  return theme.page.slider
}
