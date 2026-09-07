"use client"

import { ArrowRight, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

const practiceChrome = facultyEmbedChrome("practice")
const practiceFamily = practiceChrome.theme.family

export function PracticeStudentCard({
  index = 0,
  layout = "card",
  name,
  section,
  attempts,
  avgScore,
  correct,
  total,
  lastPracticed,
  onSelect,
}: {
  index?: number
  layout?: "card" | "list"
  name: string
  section: string
  attempts: number
  avgScore: number
  correct: number
  total: number
  lastPracticed?: string | null
  onSelect: () => void
}) {
  const lastLabel = lastPracticed
    ? new Date(lastPracticed).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "Never"
  const stripe = portalListStripe(index, practiceFamily)
  const scoreTone =
    avgScore >= 80 ? practiceChrome.success : avgScore >= 60 ? practiceChrome.warning : practiceChrome.quiet

  const stats = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums", scoreTone)}>
        {avgScore.toFixed(0)}% avg
      </span>
      <span className={cn("rounded-full bg-[var(--card)]/80 px-2 py-0.5 text-[10px] font-medium", PORTAL_TEXT_MUTED)}>
        {attempts} attempt{attempts === 1 ? "" : "s"}
      </span>
      <span className={cn("rounded-full bg-[var(--card)]/80 px-2 py-0.5 text-[10px] font-medium", PORTAL_TEXT_MUTED)}>
        {correct}/{total} correct
      </span>
      <span className={cn("rounded-full bg-[var(--card)]/80 px-2 py-0.5 text-[10px] font-medium", PORTAL_TEXT_MUTED)}>
        Last {lastLabel}
      </span>
    </div>
  )

  if (layout === "list") {
    return (
      <article className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--cc-accent-soft)]/45">
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
            <Users className={cn("h-4 w-4", stripe.iconText)} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h3 className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>{name}</h3>
              <span className={cn("truncate text-[11px]", PORTAL_TEXT_MUTED)}>{section}</span>
            </div>
            <div className="mt-1.5">{stats}</div>
          </div>
          <span
            className={cn(
              "hidden shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold sm:inline-flex",
              stripe.iconBg,
              stripe.iconText,
            )}
          >
            Open report
            <ArrowRight className="h-3 w-3" />
          </span>
        </button>
      </article>
    )
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-left transition-colors hover:bg-[var(--cc-accent-soft)]/45">
      <button type="button" onClick={onSelect} className="w-full p-3 text-left">
        <div className="flex items-start gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
            <Users className={cn("h-4 w-4", stripe.iconText)} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <h3 className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>{name}</h3>
              <p className={cn("mt-0.5 text-[11px]", PORTAL_TEXT_MUTED)}>{section}</p>
            </div>
            {stats}
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold",
              stripe.iconBg,
              stripe.iconText,
            )}
          >
            Report
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </button>
    </article>
  )
}
