"use client"

import { Check, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePracticeChrome } from "@/hooks/use-practice-chrome"
import { practiceChromeKpi } from "@/lib/practice-chrome-theme"
import type { PracticeBadgeView } from "@/lib/practice-badge-catalog"

const JEANS_CARD = cn(
  "relative flex w-full flex-col rounded-xl border bg-white border-gray-200 shadow-md",
  "transition-shadow duration-300 hover:shadow-lg",
  "dark:border-white/15 dark:bg-[color-mix(in_srgb,var(--card)_78%,white)]",
  "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_22px_rgba(0,0,0,0.45)]",
)

type PracticeBadgeCardProps = {
  badge: PracticeBadgeView
  colorIndex?: number
}

/** Material-style floating crest badge card (CodeBench pattern, Practice chrome). */
export function PracticeBadgeCard({ badge, colorIndex = 0 }: PracticeBadgeCardProps) {
  const { roles } = usePracticeChrome()
  const thumb = practiceChromeKpi(colorIndex, roles)
  // Locked stays themed — soft tint of chrome fill, not gray mute.
  const fill = badge.unlocked
    ? thumb.fill
    : `color-mix(in srgb, ${thumb.fill} 48%, var(--card))`
  const onFill = badge.unlocked ? thumb.icon : thumb.fill
  const Icon = badge.icon
  const title = badge.earnedName || badge.name
  const description = badge.earnedDescription || badge.description

  return (
    <div className={JEANS_CARD}>
      <div
        className="relative mx-4 -mt-5 flex h-36 items-center justify-center overflow-hidden rounded-xl shadow-lg sm:h-40"
        style={{
          backgroundColor: fill,
          color: onFill,
          boxShadow: `0 10px 24px -8px ${thumb.fill}${badge.unlocked ? "99" : "55"}`,
        }}
      >
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
        <Icon
          className={cn("relative z-10 size-16 sm:size-20", !badge.unlocked && "opacity-80")}
          strokeWidth={1.75}
        />
        <div
          className={cn(
            "absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full shadow-md",
            badge.unlocked ? "bg-white/90 text-emerald-600" : "bg-white/85",
          )}
          style={!badge.unlocked ? { color: thumb.fill } : undefined}
        >
          {badge.unlocked ? <Check className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <p
          className="mb-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: thumb.fill }}
        >
          {badge.category}
        </p>
        <h5 className="mb-2 text-lg font-semibold leading-snug tracking-tight text-gray-800 dark:text-[var(--cc-text)]">
          {title}
        </h5>
        <p className="text-sm leading-relaxed text-gray-700 dark:text-[var(--cc-text-muted)]">
          {description}
        </p>
        {badge.unlocked && badge.unlockedAt ? (
          <p className="mt-3 text-xs font-medium" style={{ color: thumb.fill }}>
            Unlocked {new Date(badge.unlockedAt).toLocaleDateString()}
          </p>
        ) : (
          <p className="mt-3 text-xs font-medium text-gray-700 dark:text-[var(--cc-text-muted)]">
            Locked — keep practicing to earn this
          </p>
        )}
      </div>
    </div>
  )
}
