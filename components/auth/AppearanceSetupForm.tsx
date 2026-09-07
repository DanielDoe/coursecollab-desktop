"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { Monitor, Moon, Palette, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemePreviewCard } from "@/components/appearance/AppearanceSettingsPanel"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { runThemeReveal } from "@/components/ui/animated-theme-toggler"
import {
  type AppearanceAudience,
  appearanceDestinationFor,
  appearanceRoleFor,
  persistAppearanceSetupComplete,
} from "@/lib/appearance/appearance-setup"
import {
  type AppearanceMode,
} from "@/lib/appearance/app-themes"
import { getAppearancePickerThemeGroups } from "@/lib/appearance/module-chrome"
import { cn } from "@/lib/utils"

const APPEARANCE_MODES: Array<{ id: AppearanceMode; label: string; icon: typeof Sun }> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
]

type Props = {
  /** Drives both which table the flag lands in and where the button goes. */
  audience: AppearanceAudience
  userId: string
  displayName?: string
}

/** Faculty land on course selection, not a dashboard — so the label moves too. */
const CONTINUE_LABEL: Record<AppearanceAudience, string> = {
  student: "Continue to dashboard",
  summer_camper: "Continue to camp",
  guest: "Continue to dashboard",
  instructor: "Continue to your courses",
}

export function AppearanceSetupForm({ audience, userId, displayName }: Props) {
  const router = useRouter()
  const {
    ready,
    appearanceMode,
    themeId,
    systemScheme,
    setAppearanceMode,
    setThemeId,
    tokens,
  } = useAppearance()

  const firstName = useMemo(() => {
    const trimmed = displayName?.trim()
    if (!trimmed) return null
    return trimmed.split(/\s+/)[0]
  }, [displayName])

  const selectAppearanceMode = (id: AppearanceMode, origin?: DOMRect | null) => {
    const currentlyDark = tokens.isDark
    const nextDark =
      id === "dark" ? true : id === "light" ? false : systemScheme === "dark"
    if (currentlyDark === nextDark) {
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

  const finish = async () => {
    await persistAppearanceSetupComplete(userId, appearanceRoleFor(audience))
    router.replace(appearanceDestinationFor(audience))
  }

  if (!ready) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500">
        Loading themes…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-200">
          <Palette className="size-3.5" />
          Personalize CourseCollab
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {firstName ? `Welcome, ${firstName}` : "Choose your look"}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          Pick a theme and light or dark mode. You can change these anytime in Settings.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Appearance mode
        </p>
        <div className="grid grid-cols-3 gap-2">
          {APPEARANCE_MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={(e) => selectAppearanceMode(id, e.currentTarget.getBoundingClientRect())}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-medium transition-all",
                appearanceMode === id
                  ? "border-[var(--cc-accent)] bg-[var(--cc-accent)]/10 text-[var(--cc-text)]"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Theme
        </p>
        <div className="max-h-[min(52vh,420px)] space-y-4 overflow-y-auto pr-1">
          {getAppearancePickerThemeGroups().map((group) => (
            <div key={group.id} className="space-y-2">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{group.title}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
        </div>
      </div>

      <Button
        type="button"
        className="w-full h-12 rounded-xl text-base font-semibold"
        onClick={finish}
      >
        {CONTINUE_LABEL[audience]}
      </Button>
    </div>
  )
}
