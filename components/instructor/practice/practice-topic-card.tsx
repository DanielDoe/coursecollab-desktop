"use client"

import { ArrowRight, Brain } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

const practiceChrome = facultyEmbedChrome("practice")
const practiceFamily = practiceChrome.theme.family

export function PracticeTopicCard({
  index = 0,
  layout = "card",
  name,
  questionCount,
  dailyLimit,
  isAvailable,
  sessionLabel,
  enabledSessions,
  sessionCount,
  onToggle,
  onSelect,
}: {
  index?: number
  layout?: "card" | "list"
  name: string
  questionCount: number
  dailyLimit: number
  isAvailable: boolean
  sessionLabel?: string
  enabledSessions?: number
  sessionCount?: number
  onToggle: () => void
  onSelect: () => void
}) {
  const stripe = portalListStripe(index, practiceFamily)
  const statusClass = isAvailable ? practiceChrome.success : practiceChrome.quiet
  const sessionCoverage =
    sessionCount && sessionCount > 0
      ? `${enabledSessions ?? 0}/${sessionCount} sessions on`
      : null

  const stats = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusClass)}>
        {isAvailable ? "Enabled" : "Disabled"}
      </span>
      <span className={cn("rounded-full bg-[var(--card)]/80 px-2 py-0.5 text-[10px] font-medium", PORTAL_TEXT_MUTED)}>
        {questionCount} questions
      </span>
      <span className={cn("rounded-full bg-[var(--card)]/80 px-2 py-0.5 text-[10px] font-medium", PORTAL_TEXT_MUTED)}>
        {dailyLimit}/day
      </span>
      {sessionCoverage ? (
        <span className={cn("rounded-full bg-[var(--card)]/80 px-2 py-0.5 text-[10px] font-medium", PORTAL_TEXT_MUTED)}>
          {sessionCoverage}
        </span>
      ) : null}
    </div>
  )

  const configureChip = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold",
        stripe.iconBg,
        stripe.iconText,
      )}
    >
      Configure
      <ArrowRight className="h-3 w-3" />
    </span>
  )

  if (layout === "list") {
    return (
      <article className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--cc-accent-soft)]/45">
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
            <Brain className={cn("h-4 w-4", stripe.iconText)} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h3 className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>{name}</h3>
              {sessionLabel ? (
                <span className={cn("truncate text-[11px]", PORTAL_TEXT_MUTED)}>{sessionLabel}</span>
              ) : null}
            </div>
            <div className="mt-1.5">{stats}</div>
          </div>
        </button>
        <Switch
          checked={isAvailable}
          onCheckedChange={() => onToggle()}
          className={cn("shrink-0", practiceChrome.switchChecked)}
          aria-label={`Toggle ${name}`}
        />
        <button type="button" onClick={onSelect} className="hidden shrink-0 sm:inline-flex">
          {configureChip}
        </button>
      </article>
    )
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-left transition-colors hover:bg-[var(--cc-accent-soft)]/45">
      <div className="flex items-start gap-3 p-3">
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 gap-3 text-left">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
            <Brain className={cn("h-4 w-4", stripe.iconText)} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <h3 className={cn("line-clamp-2 text-sm font-semibold leading-snug", PORTAL_TEXT)}>{name}</h3>
              {sessionLabel ? (
                <p className={cn("mt-0.5 text-[11px]", PORTAL_TEXT_MUTED)}>{sessionLabel}</p>
              ) : null}
            </div>
            {stats}
          </div>
        </button>
        <Switch
          checked={isAvailable}
          onCheckedChange={() => onToggle()}
          className={cn("mt-0.5 shrink-0", practiceChrome.switchChecked)}
          aria-label={`Toggle ${name}`}
        />
      </div>
      <div className="flex justify-end px-3 pb-3">
        <button type="button" onClick={onSelect}>
          {configureChip}
        </button>
      </div>
    </article>
  )
}
