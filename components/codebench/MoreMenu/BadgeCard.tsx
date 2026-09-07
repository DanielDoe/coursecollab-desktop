"use client"

import { Lock, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { codebenchChromeKpi } from "@/lib/codebench-chrome-theme"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { BadgeMark } from "./BadgeMark"

interface Badge {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt?: string
}

interface BadgeCardProps {
  badge: Badge
  embedInDashboard?: boolean
  /** Cycles Color Hunt chrome fills so the grid stays colorful */
  colorIndex?: number
}

export function BadgeCard({ badge, embedInDashboard, colorIndex = 0 }: BadgeCardProps) {
  const { roles } = useCodebenchChrome()
  const thumb = codebenchChromeKpi(colorIndex, roles)
  const fill = thumb.fill
  const onFill = thumb.icon

  const emblem = (
    <div
      className="relative mx-4 -mt-6 flex h-40 items-center justify-center overflow-hidden rounded-xl shadow-lg"
      style={{
        backgroundColor: fill,
        color: onFill,
        boxShadow: `0 10px 24px -8px ${fill}99`,
      }}
    >
      {/* Decorative pattern unique to the card face */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35), transparent 45%), radial-gradient(circle at 80% 80%, rgba(0,0,0,0.18), transparent 40%)",
        }}
      />
      <div
        className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full opacity-20"
        style={{ backgroundColor: onFill }}
      />
      <div
        className="pointer-events-none absolute -bottom-8 -left-4 size-24 rounded-full opacity-15"
        style={{ backgroundColor: onFill }}
      />
      <div className="relative z-10 size-28 sm:size-32">
        <BadgeMark badgeId={badge.id} />
      </div>
    </div>
  )

  if (embedInDashboard) {
    return (
      <div className="relative flex w-full flex-col rounded-xl bg-[var(--card)] text-[var(--cc-text)] shadow-md">
        {emblem}
        <div className="p-6">
          <h5 className={cn("mb-2 text-xl font-semibold leading-snug tracking-normal", PORTAL_TEXT)}>
            {badge.name}
          </h5>
          <p className={cn("text-sm font-normal leading-relaxed", PORTAL_TEXT_MUTED)}>{badge.description}</p>
          {badge.unlocked && badge.unlockedAt ? (
            <p className="mt-2 text-xs font-medium text-[var(--cc-accent-dark)]">
              Unlocked {new Date(badge.unlockedAt).toLocaleDateString()}
            </p>
          ) : null}
        </div>
        <div className="p-6 pt-0">
          <button
            type="button"
            disabled
            className="inline-flex select-none items-center gap-1.5 rounded-lg px-5 py-2.5 text-center text-xs font-bold uppercase tracking-wide shadow-md transition-shadow"
            style={{
              backgroundColor: fill,
              color: onFill,
              boxShadow: `0 4px 14px -4px ${fill}88`,
            }}
          >
            {badge.unlocked ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden />
                Unlocked
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" aria-hidden />
                Locked
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex w-full flex-col rounded-xl bg-slate-900 text-slate-100 shadow-md">
      {emblem}
      <div className="p-6">
        <h5 className="mb-2 text-xl font-semibold">{badge.name}</h5>
        <p className="text-sm font-light text-slate-300">{badge.description}</p>
      </div>
      <div className="p-6 pt-0">
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-xs font-bold uppercase shadow-md"
          style={{ backgroundColor: fill, color: onFill }}
        >
          {badge.unlocked ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Unlocked
            </>
          ) : (
            <>
              <Lock className="h-3.5 w-3.5" />
              Locked
            </>
          )}
        </button>
      </div>
    </div>
  )
}
