"use client"

import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

const practiceChrome = facultyEmbedChrome("practice")
const practiceFamily = practiceChrome.theme.family

export function PracticeActivityCard({
  index = 0,
  studentName,
  topics,
  timestamp,
  score,
  correct,
  total,
}: {
  studentName: string
  topics: string[]
  timestamp: string
  score: number
  correct: number
  total: number
  index?: number
}) {
  const topicLabel = topics.slice(0, 2).join(", ") + (topics.length > 2 ? "…" : "")
  const when = new Date(timestamp).toLocaleString("en-US", { timeZone: "America/Chicago" })
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Needs help"
  const stripe = portalListStripe(index, practiceFamily)
  const scoreTone =
    score >= 80 ? practiceChrome.success : score >= 60 ? practiceChrome.warning : practiceChrome.danger

  return (
    <article className={cn("overflow-hidden rounded-2xl border p-3", stripe.border, stripe.row)}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            stripe.iconBg,
          )}
        >
          <Clock className={cn("h-4 w-4", stripe.iconText)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>{studentName}</p>
              <p className={cn("mt-0.5 truncate text-xs", PORTAL_TEXT_MUTED)}>{topicLabel || "Practice"}</p>
              <p className={cn("mt-0.5 text-[11px]", PORTAL_TEXT_MUTED)}>{when}</p>
            </div>
            <p className={cn("text-lg font-semibold tabular-nums", PORTAL_TEXT)}>{score.toFixed(0)}%</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", scoreTone)}>
              {label}
            </span>
            <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {correct}/{total} correct
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}
