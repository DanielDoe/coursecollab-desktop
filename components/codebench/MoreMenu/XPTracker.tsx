"use client"

import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"

interface XPTrackerProps {
  xp: number
  variant?: "inline" | "dropdown"
  theme?: "light" | "dark"
}

export function XPTracker({ xp, variant = "inline", theme = "dark" }: XPTrackerProps) {
  const isLight = theme === "light"
  const { accent, roles } = useCodebenchChrome()
  const level = Math.floor(xp / 100) + 1
  const xpInCurrentLevel = xp % 100
  const progress = (xpInCurrentLevel / 100) * 100

  if (variant === "dropdown") {
    return (
      <div className="space-y-2.5" data-codebench-xp-tracker>
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm"
            style={{ backgroundColor: roles.badge.fill, color: roles.badge.icon }}
          >
            <Zap className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: accent }}
            >
              Level {level}
            </p>
            <p
              className={cn(
                "text-lg font-extrabold tabular-nums",
                isLight ? "!text-slate-900" : "!text-white",
              )}
            >
              {xp.toLocaleString()} XP
            </p>
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold">
            <span className={cn(isLight ? "!text-slate-700" : "!text-slate-300")}>
              Progress to Lv {level + 1}
            </span>
            <span className="shrink-0 tabular-nums" style={{ color: accent }}>
              {xpInCurrentLevel}/100
            </span>
          </div>
          <div
            className={cn(
              "h-2 overflow-hidden rounded-full",
              isLight ? "bg-slate-200" : "bg-white/10",
            )}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: accent }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2 rounded-full border px-2.5 py-1"
      style={{
        borderColor: `${accent}66`,
        backgroundColor: `${accent}26`,
        color: accent,
      }}
    >
      <Zap className="h-3.5 w-3.5" />
      <span className="text-xs font-extrabold tabular-nums">{xp.toLocaleString()} XP</span>
      <span className="text-[10px] font-semibold opacity-80">Lv {level}</span>
    </div>
  )
}
