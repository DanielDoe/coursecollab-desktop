"use client"

import { useMemo } from "react"
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import {
  THEME_DEFINITIONS,
  resolveThemePreviewTokens,
  themeIsDarkFirst,
  type AppearanceMode,
  type AppThemeTokens,
  type ThemeId,
} from "@/lib/appearance/app-themes"
import { getAppearancePickerThemeGroups } from "@/lib/appearance/module-chrome"
import {
  getSemanticPalettePreviewColors,
  SEMANTIC_PALETTE_DEFINITIONS,
  type SemanticPaletteId,
} from "@/lib/appearance/semantic-palettes"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { runThemeReveal } from "@/components/ui/animated-theme-toggler"

const APPEARANCE_MODES: Array<{ id: AppearanceMode; label: string; icon: typeof Sun }> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
]

export function ThemePreviewCard({
  themeId,
  selected,
  onSelect,
  appearanceMode,
  systemScheme,
}: {
  themeId: ThemeId
  selected: boolean
  onSelect: () => void
  appearanceMode: AppearanceMode
  systemScheme: "light" | "dark"
}) {
  const def = THEME_DEFINITIONS.find((t) => t.id === themeId)!
  const preview = useMemo(
    () => resolveThemePreviewTokens(themeId, appearanceMode, systemScheme),
    [themeId, appearanceMode, systemScheme],
  )

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]",
        selected ? "border-[var(--cc-accent)] shadow-md" : "border-transparent",
      )}
      style={{ backgroundColor: preview.surface }}
      aria-pressed={selected}
    >
      <div
        className="relative h-24 p-3"
        style={{
          background: preview.backgroundGradient
            ? `linear-gradient(135deg, ${preview.backgroundGradient.join(", ")})`
            : preview.background,
        }}
      >
        <div
          className="flex items-center gap-2 rounded-lg border px-2 py-1.5 backdrop-blur-md"
          style={{
            backgroundColor: preview.glass.surface,
            borderColor: preview.glass.border,
          }}
        >
          <span className="size-2 rounded-full" style={{ backgroundColor: preview.accent }} />
          <span className="h-1.5 flex-1 rounded-full opacity-70" style={{ backgroundColor: preview.text }} />
          <span className="size-1.5 rounded-full" style={{ backgroundColor: preview.danger }} />
        </div>
        <div className="mt-2 flex gap-1.5">
          <div
            className="flex-1 rounded-md border px-1.5 py-1"
            style={{ backgroundColor: preview.elevatedSurface, borderColor: preview.border }}
          >
            <p className="text-[10px] font-bold" style={{ color: preview.text }}>
              92
            </p>
          </div>
          <div
            className="h-8 w-8 rounded-md"
            style={{ backgroundColor: preview.accent }}
          />
        </div>
        {selected ? (
          <span
            className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: preview.accent }}
          >
            <Check className="size-3" />
          </span>
        ) : null}
      </div>
      <div className="border-t px-3 py-2" style={{ borderColor: preview.border }}>
        <p className="text-xs font-semibold" style={{ color: preview.text }}>
          {def.name}
        </p>
        <p className="text-[10px]" style={{ color: preview.textMuted }}>
          {def.tagline}
          {themeIsDarkFirst(themeId) ? " · Always dark" : ""}
        </p>
      </div>
    </button>
  )
}

function SemanticPalettePreviewCard({
  paletteId,
  name,
  tagline,
  selected,
  onSelect,
  tokens,
}: {
  paletteId: SemanticPaletteId
  name: string
  tagline: string
  selected: boolean
  onSelect: () => void
  tokens: AppThemeTokens
}) {
  const swatches = getSemanticPalettePreviewColors(paletteId, tokens.accent)
  const labels = ["Dashboard", "Learning", "Assessments", "Collab", "Rewards", "Course"]

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]",
        selected ? "border-[var(--cc-accent)] shadow-md" : "border-[var(--border)]",
      )}
      aria-pressed={selected}
    >
      <div className="space-y-2 p-3" style={{ backgroundColor: tokens.surface }}>
        <div className="flex items-center gap-1.5">
          {swatches.map((color, i) => (
            <span
              key={`${paletteId}-${i}`}
              className="size-6 shrink-0 rounded-lg border shadow-sm"
              style={{
                backgroundColor: color,
                borderColor: tokens.border,
              }}
              title={labels[i]}
            />
          ))}
        </div>
        <div className="flex gap-1">
          {swatches.slice(0, 4).map((color, i) => (
            <div
              key={`bar-${paletteId}-${i}`}
              className="h-1.5 flex-1 rounded-full opacity-90"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        {selected ? (
          <span
            className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: tokens.accent }}
          >
            <Check className="size-3" />
          </span>
        ) : null}
      </div>
      <div className="border-t px-3 py-2" style={{ borderColor: tokens.border, backgroundColor: tokens.card }}>
        <p className="text-xs font-semibold text-[var(--cc-text)]">{name}</p>
        <p className="text-[10px] text-[var(--cc-text-muted)]">{tagline}</p>
      </div>
    </button>
  )
}

export function AppearanceSettingsPanel({ className }: { className?: string }) {
  const {
    ready,
    appearanceMode,
    themeId,
    semanticColorsEnabled,
    semanticPaletteId,
    systemScheme,
    setAppearanceMode,
    setThemeId,
    setSemanticColorsEnabled,
    setSemanticPaletteId,
    tokens,
  } = useAppearance()

  const selectAppearanceMode = (
    id: AppearanceMode,
    origin?: DOMRect | null,
  ) => {
    const currentlyDark = tokens.isDark
    const nextDark =
      id === "dark" ? true : id === "light" ? false : systemScheme === "dark"
    const shouldAnimate = currentlyDark !== nextDark

    if (!shouldAnimate) {
      setAppearanceMode(id)
      return
    }

    runThemeReveal({
      origin: origin ?? null,
      fromCenter: !origin,
      nextTheme: nextDark ? "dark" : "light",
      applyTheme: () => {
        document.documentElement.classList.toggle("dark", nextDark)
        setAppearanceMode(id)
      },
    })
  }

  if (!ready) {
    return (
      <div className={cn("space-y-8", className)} aria-busy="true">
        <div className="h-24 animate-pulse rounded-xl bg-[var(--muted)]" />
        <div className="h-40 animate-pulse rounded-xl bg-[var(--muted)]" />
        <div className="h-64 animate-pulse rounded-xl bg-[var(--muted)]" />
      </div>
    )
  }

  return (
    <div className={cn("space-y-8", className)}>
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--cc-text)]">Appearance mode</h2>
          <p className="text-sm text-[var(--cc-text-muted)]">
            Choose light, dark, or match your device setting.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:max-w-md">
          {APPEARANCE_MODES.map(({ id, label, icon: Icon }) => {
            const active = appearanceMode === id
            return (
              <button
                key={id}
                type="button"
                onClick={(e) => selectAppearanceMode(id, e.currentTarget.getBoundingClientRect())}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition-colors",
                  active
                    ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text-secondary)] hover:bg-[var(--muted)]",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--cc-text)] flex items-center gap-2">
              <Palette className="size-4 text-[var(--cc-accent-dark)]" />
              Semantic module colors
            </h2>
            <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
              Optional second layer: each sidebar accordion (Assessments, Learning Center, etc.)
              gets one shared accent on all its items and pages. Off keeps the classic unified theme.
            </p>
          </div>
          <Switch
            checked={semanticColorsEnabled}
            onCheckedChange={setSemanticColorsEnabled}
            aria-label="Enable semantic module colors"
          />
        </div>

        {semanticColorsEnabled ? (
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--cc-text)]">Semantic color scheme</h3>
              <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">
                Pick how sidebar groups and their pages are tinted. Your brand theme still controls
                buttons and the active nav highlight.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SEMANTIC_PALETTE_DEFINITIONS.map((palette) => (
                <SemanticPalettePreviewCard
                  key={palette.id}
                  paletteId={palette.id}
                  name={palette.name}
                  tagline={palette.tagline}
                  selected={semanticPaletteId === palette.id}
                  onSelect={() => setSemanticPaletteId(palette.id)}
                  tokens={tokens}
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-[var(--cc-text)]">Color theme</h2>
          <p className="text-sm text-[var(--cc-text-muted)]">
            All {THEME_DEFINITIONS.length} themes in named collections — campus brands, twilight
            atelier, horizon waters, verdant commons, ember & copper, crimson gallery, and quiet
            metals. Glass and dark twins sit with their family.
          </p>
          <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
            Active: <strong className="text-[var(--cc-accent-dark)]">{tokens.name}</strong>
          </p>
        </div>
        {getAppearancePickerThemeGroups().map((group) => (
          <div key={group.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-[var(--cc-text)]">{group.title}</h3>
                <p className="text-xs text-[var(--cc-text-muted)]">{group.description}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
                  {group.lockedPaletteLabel}
                </span>
                <div className="flex items-center gap-1.5" aria-hidden>
                  {group.chromeSwatches.map((swatch, idx) => (
                    <div
                      key={`${group.id}-swatch-${idx}`}
                      className="flex overflow-hidden rounded-md border border-[var(--border)]"
                    >
                      {swatch.map((stop) => (
                        <span
                          key={`${stop}-${idx}`}
                          className="h-5 w-5"
                          style={{ backgroundColor: stop }}
                          title={stop}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {group.themes.map((def) => (
                <ThemePreviewCard
                  key={def.id}
                  themeId={def.id}
                  selected={themeId === def.id}
                  onSelect={() => setThemeId(def.id)}
                  appearanceMode={appearanceMode}
                  systemScheme={systemScheme}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section
        className="rounded-xl border p-4"
        style={{
          borderColor: tokens.border,
          backgroundColor: tokens.tint,
        }}
      >
        <p className="text-sm font-medium text-[var(--cc-text)]">Live preview</p>
        <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
          Primary buttons and accents use your selected theme.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: tokens.accent }}
          >
            Primary action
          </button>
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm font-medium"
            style={{
              borderColor: tokens.border,
              color: tokens.text,
              backgroundColor: tokens.surface,
            }}
          >
            Secondary
          </button>
          <span
            className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
            style={{ backgroundColor: tokens.accentSoft, color: tokens.accentDark }}
          >
            Badge
          </span>
        </div>
      </section>
    </div>
  )
}
