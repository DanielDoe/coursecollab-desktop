import type { AppThemeTokens } from "@/lib/appearance/app-themes"
import { hexToRgba } from "@/lib/appearance/app-themes"
import {
  clearBrandSurfaceBrowserChromeFlag,
  isBrandPublicChromePath,
  syncBrandSurfaceBrowserChrome,
} from "@/lib/appearance/brand-surface-chrome"
import { drawerNavThemeFromTokens } from "@/lib/appearance/drawer-nav-theme"
import { applyAccentAliasSemanticTokens, applySemanticTokens, buildSemanticPalette } from "@/lib/appearance/semantic-tokens"
import { DEFAULT_SEMANTIC_PALETTE_ID, type SemanticPaletteId } from "@/lib/appearance/semantic-palettes"

export type ApplyWebThemeOptions = {
  semanticColorsEnabled?: boolean
  semanticPaletteId?: SemanticPaletteId
}

/** Safari / mobile browser chrome (URL bar, bottom toolbar) follows theme-color + color-scheme. */
export function syncBrowserChromeTheme(options: { isDark: boolean; background: string }): void {
  if (typeof document === "undefined") return

  const root = document.documentElement
  root.style.colorScheme = options.isDark ? "dark" : "light"
  root.style.backgroundColor = options.background

  const metas = document.querySelectorAll('meta[name="theme-color"]')
  if (metas.length === 0) {
    const themeColorMeta = document.createElement("meta")
    themeColorMeta.name = "theme-color"
    themeColorMeta.content = options.background
    document.head.appendChild(themeColorMeta)
  } else {
    metas.forEach((node) => {
      const meta = node as HTMLMetaElement
      meta.content = options.background
      meta.removeAttribute("media")
    })
  }

  let statusBarMeta = document.querySelector(
    'meta[name="apple-mobile-web-app-status-bar-style"]',
  ) as HTMLMetaElement | null
  if (!statusBarMeta) {
    statusBarMeta = document.createElement("meta")
    statusBarMeta.name = "apple-mobile-web-app-status-bar-style"
    document.head.appendChild(statusBarMeta)
  }
  statusBarMeta.content = options.isDark ? "black-translucent" : "default"
}

/** Structural UI tokens — reference semantic vars set above */
function applyUiPrimitiveTokens(root: HTMLElement, tokens: AppThemeTokens): void {
  const set = (name: string, value: string) => root.style.setProperty(name, value)
  const surfaceMuted = tokens.isDark ? tokens.tint : "#FAFAFA"
  set("--cc-ui-surface", tokens.isDark ? tokens.card : "#FFFFFF")
  set("--cc-ui-surface-muted", surfaceMuted)
  set("--cc-ui-overlay-surface", tokens.surface)
  set("--cc-ui-border", tokens.border)
  set("--cc-ui-spinner-track", tokens.border)
  set("--cc-ui-spinner-active", "var(--cc-sem-primary)")
  set("--cc-ui-switch-checked", "var(--cc-sem-primary)")
  set("--cc-ui-progress-fill", "var(--cc-sem-primary)")
  set("--cc-ui-progress-track", hexToRgba(tokens.accent, tokens.isDark ? 0.22 : 0.12))
  set("--cc-ui-table-header", tokens.selected)
  set("--cc-ui-table-row-hover", tokens.isDark ? "rgba(255,255,255,0.06)" : tokens.selected)
  set("--cc-ui-table-row-selected", tokens.selected)
  set("--cc-ui-tabs-list-bg", tokens.selected)
  set("--cc-ui-tabs-active-bg", tokens.card)
  set("--cc-ui-tabs-active-text", "var(--cc-sem-primary-text)")
  set("--cc-ui-focus-border", "var(--cc-sem-primary)")
  set("--cc-ui-focus-glow", "var(--cc-sem-primary-glow)")
  set("--cc-ui-skeleton", tokens.isDark ? "rgba(255,255,255,0.08)" : tokens.selected)
  set("--cc-ui-calendar-selected", "var(--cc-sem-calendar)")
  set("--cc-ui-calendar-today-bg", "var(--cc-sem-calendar-soft)")
  set("--cc-ui-scrollbar-track", hexToRgba(tokens.accent, tokens.isDark ? 0.1 : 0.08))
  set("--cc-ui-scrollbar-thumb", hexToRgba(tokens.accent, tokens.isDark ? 0.42 : 0.35))
  set(
    "--cc-ui-scrollbar-thumb-hover",
    hexToRgba(tokens.accentHover || tokens.accent, tokens.isDark ? 0.58 : 0.5),
  )
}

export function applyWebTheme(tokens: AppThemeTokens, options: ApplyWebThemeOptions = {}): void {
  if (typeof document === "undefined") return
  const root = document.documentElement
  const set = (name: string, value: string) => root.style.setProperty(name, value)

  const pageBackground = tokens.background
  const cardSurface = tokens.isDark ? tokens.card : "#FFFFFF"
  const surfaceLight = tokens.isDark ? tokens.surface : "#FFFFFF"
  const mutedLight = tokens.isDark ? tokens.tint : "#EEEEF2"
  const borderLight = tokens.isDark ? tokens.border : "#EBEBEB"

  if (tokens.isDark) root.classList.add("dark")
  else root.classList.remove("dark")

  const onBrandPublic =
    typeof window !== "undefined" && isBrandPublicChromePath(window.location.pathname)
  if (onBrandPublic) {
    syncBrandSurfaceBrowserChrome()
  } else {
    clearBrandSurfaceBrowserChromeFlag()
    syncBrowserChromeTheme({ isDark: tokens.isDark, background: pageBackground })
  }
  root.dataset.ccThemeId = tokens.id
  root.dataset.ccThemeGlass = tokens.glass.blurRadius >= 20 ? "true" : "false"
  const semanticOn = options.semanticColorsEnabled === true
  const semanticPaletteId = options.semanticPaletteId ?? DEFAULT_SEMANTIC_PALETTE_ID
  root.dataset.ccSemanticColors = semanticOn ? "true" : "false"
  root.dataset.ccSemanticPalette = semanticPaletteId

  set("--cc-accent", tokens.accent)
  set("--cc-accent-hover", tokens.accentHover)
  set("--cc-accent-soft", tokens.accentSoft)
  set("--cc-accent-soft-strong", tokens.accentSoftStrong)
  set("--cc-accent-border", tokens.accentBorder)
  set("--cc-accent-dark", tokens.accentDark)
  set("--cc-background", pageBackground)
  set("--cc-surface", surfaceLight)
  set("--cc-text", tokens.text)
  set("--cc-text-secondary", tokens.textSecondary)
  set("--cc-text-muted", tokens.textMuted)
  set("--cc-warning", tokens.warning)
  set("--cc-success", tokens.success)
  set("--cc-danger", tokens.danger)
  set("--cc-info", "#3B82F6")
  set("--cc-glass-surface", tokens.isDark ? tokens.glass.surface : "#FFFFFF")
  set("--cc-glass-border", tokens.glass.border)
  set("--cc-glass-blur", `${tokens.glass.blurRadius}px`)

  const glassActive = tokens.glass.blurRadius >= 20
  const modalSurface =
    glassActive || tokens.card.includes("rgba") || tokens.surface.includes("rgba")
      ? tokens.isDark
        ? "#1e293b"
        : "#ffffff"
      : tokens.card
  set("--cc-modal-surface", modalSurface)
  set("--cc-modal-muted", tokens.isDark ? "#334155" : "#f4f4f5")
  set(
    "--cc-modal-scrim",
    glassActive
      ? tokens.isDark
        ? "rgba(0,0,0,0.88)"
        : "rgba(15,23,42,0.82)"
      : tokens.isDark
        ? "rgba(0,0,0,0.82)"
        : "rgba(15,23,42,0.72)",
  )

  set("--primary", tokens.accent)
  set("--primary-foreground", "#ffffff")
  set("--background", pageBackground)
  set("--foreground", tokens.text)
  set("--card", cardSurface)
  set("--card-foreground", tokens.text)
  set("--popover", surfaceLight)
  set("--popover-foreground", tokens.text)
  set("--secondary", mutedLight)
  set("--secondary-foreground", tokens.text)
  set("--muted", mutedLight)
  set("--muted-foreground", tokens.textMuted)
  set("--accent", mutedLight)
  set("--accent-foreground", tokens.text)
  set("--border", borderLight)
  set("--input", borderLight)
  set("--ring", tokens.accentBorder)
  set("--destructive", tokens.danger)
  set("--destructive-foreground", "#ffffff")

  // Light hover wash must clear white/lavender page bg (tint alone is invisible on Apple Lavender).
  const sidebarSoft = tokens.isDark
    ? hexToRgba(tokens.accent, 0.22)
    : hexToRgba(tokens.accent, 0.2)
  set("--sidebar", tokens.isDark ? tokens.background : "#FFFFFF")
  set("--sidebar-foreground", tokens.text)
  set("--sidebar-primary", tokens.accent)
  set("--sidebar-primary-foreground", "#ffffff")
  set("--sidebar-accent", sidebarSoft)
  set("--sidebar-accent-foreground", tokens.accent)
  set("--sidebar-border", tokens.border)
  set("--sidebar-ring", tokens.accent)

  set("--pv-sidebar-active", tokens.accent)
  set("--pv-sidebar-active-bg", hexToRgba(tokens.accent, tokens.isDark ? 0.26 : 0.18))
  set("--pv-sidebar-active-icon-bg", hexToRgba(tokens.accent, tokens.isDark ? 0.32 : 0.22))

  if (tokens.backgroundGradient) {
    root.style.setProperty(
      "--cc-background-gradient",
      `linear-gradient(180deg, ${tokens.backgroundGradient.join(", ")})`,
    )
  } else {
    root.style.removeProperty("--cc-background-gradient")
  }

  const colorPairs: Array<[string, string]> = [
    ["--color-background", pageBackground],
    ["--color-foreground", tokens.text],
    ["--color-card", cardSurface],
    ["--color-card-foreground", tokens.text],
    ["--color-primary", tokens.accent],
    ["--color-primary-foreground", "#ffffff"],
    ["--color-muted", mutedLight],
    ["--color-muted-foreground", tokens.textMuted],
    ["--color-border", borderLight],
    ["--color-ring", tokens.accentBorder],
  ]
  for (const [key, value] of colorPairs) set(key, value)

  const drawer = drawerNavThemeFromTokens(tokens, glassActive)
  set("--cc-drawer-panel-bg", drawer.panelBg)
  set("--cc-drawer-border", drawer.headerBorder)
  set("--cc-drawer-label", drawer.label)
  set("--cc-drawer-label-secondary", drawer.secondaryLabel)
  set("--cc-drawer-nav-active-bg", drawer.navActiveBg)
  set("--cc-drawer-nav-active-border", drawer.navActiveBorder)
  set("--cc-drawer-nav-idle-bg", drawer.navIdleBg)
  set("--cc-drawer-nav-hover-bg", drawer.navHoverBg)
  set("--cc-drawer-icon-well-bg", drawer.iconWellBg)
  set("--cc-drawer-soft-border", drawer.softBorder)
  set("--cc-drawer-chip-active-bg", drawer.chipActiveBg)
  set("--cc-drawer-primary", drawer.primary)

  if (semanticOn) {
    applySemanticTokens(root, buildSemanticPalette(tokens, semanticPaletteId))
  } else {
    applyAccentAliasSemanticTokens(root, tokens)
  }

  applyUiPrimitiveTokens(root, tokens)

  window.dispatchEvent(
    new CustomEvent("theme-change", { detail: tokens.isDark ? "dark" : "light" }),
  )
  window.dispatchEvent(new CustomEvent("appearance-change", { detail: tokens }))
}
