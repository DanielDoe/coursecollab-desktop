"use client"

import { useState } from "react"
import { Calendar, ChevronDown, ChevronUp, Code, Gift, PenLine, Sparkles, Star, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  ClassroomPointHistoryDetail,
  classroomPointHasSubmissionDetails,
  classroomPointHistoryTitle,
  type ClassroomPointHistoryRow,
} from "@/components/classroom-point-history-detail"
import {
  resolveClassroomPointFeedbackText,
  stripAiSuffixFromReason,
  classroomPointIsProvisional,
} from "@/lib/classroom-points-ai-feedback.shared"
import { AiFeedbackMarkdown } from "@/components/ai-feedback-markdown"
import { ClassroomProvisionalScoreBadge } from "@/components/classroom-provisional-score-badge"
import { resolveClassroomDisplayPoints } from "@/lib/classroom-point-booster"

type ClassroomPointHistoryCardProps = {
  point: ClassroomPointHistoryRow & {
    points: number
    awarded_at: string
    instructor_name: string
  }
  categoryInfo: { label: string }
  animationDelay?: number
  className?: string
  embedInDashboard?: boolean
}

const CATEGORY_ICON = {
  code_submission: Code,
  solution_submission: PenLine,
  presentation: Sparkles,
  participation: Zap,
  quiz_bonus: Star,
  extra_credit: Star,
  other: Gift,
} as const

const CATEGORY_FILL: Record<string, string> = {
  code_submission: "var(--cc-accent)",
  solution_submission: "var(--cc-success)",
  presentation: "var(--cc-warning)",
  participation: "var(--cc-accent)",
  quiz_bonus: "var(--cc-warning)",
  extra_credit: "var(--cc-success)",
  other: "var(--cc-accent)",
}

export function ClassroomPointHistoryCard({
  point,
  categoryInfo,
  className,
}: ClassroomPointHistoryCardProps) {
  const [open, setOpen] = useState(false)
  const hasDetails = classroomPointHasSubmissionDetails(point)
  const title = classroomPointHistoryTitle(point)
  const aiFeedback = resolveClassroomPointFeedbackText(point)
  const reasonSubtitle = stripAiSuffixFromReason(point.reason)
  const showReasonSubtitle = Boolean(!aiFeedback && reasonSubtitle && reasonSubtitle !== title)
  const isProvisional = classroomPointIsProvisional(point)
  const isSubmissionCategory =
    point.category === "code_submission" || point.category === "solution_submission"
  const booster = Math.max(1, Number(point.point_booster) || 1)
  const displayPoints = isSubmissionCategory
    ? resolveClassroomDisplayPoints(Number(point.points) || 0, booster)
    : Number(point.points) || 0
  const Icon = CATEGORY_ICON[point.category as keyof typeof CATEGORY_ICON] ?? Gift
  const fill = CATEGORY_FILL[point.category] ?? "var(--cc-accent)"

  return (
    <div className={cn("bg-[var(--card)]", className)}>
      <button
        type="button"
        onClick={() => (hasDetails || aiFeedback ? setOpen((prev) => !prev) : undefined)}
        className="flex min-h-[88px] w-full items-center gap-3 px-3 py-2 text-left"
      >
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-[14px]"
          style={{ backgroundColor: fill, color: "#FFFFFF" }}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-sm font-semibold text-[var(--cc-text)]">{title}</p>
          <p className="truncate text-xs text-[var(--cc-text-muted)]">
            {categoryInfo.label}
            {isProvisional ? " · provisional" : ""}
            {booster > 1 && isSubmissionCategory ? ` · ${booster}× booster` : ""}
          </p>
          <p className="flex items-center gap-1 truncate text-xs text-[var(--cc-text-muted)]">
            <Calendar className="h-3 w-3 shrink-0" />
            {point.instructor_name} · {new Date(point.awarded_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-[var(--cc-text)]">
            {displayPoints.toFixed(1)}
          </span>
          {hasDetails || aiFeedback ? (
            open ? (
              <ChevronUp className="h-4 w-4 text-[var(--cc-text-muted)]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[var(--cc-text-muted)]" />
            )
          ) : null}
        </div>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-[var(--border)] px-3 py-3">
          {isProvisional ? <ClassroomProvisionalScoreBadge /> : null}
          {showReasonSubtitle ? (
            <p className="text-xs text-[var(--cc-text-muted)]">{reasonSubtitle}</p>
          ) : null}
          {aiFeedback ? (
            <div className="rounded-xl bg-[var(--muted)]/40 px-3 py-2">
              <p className="mb-1 text-[11px] font-semibold text-[var(--cc-text-muted)]">Feedback</p>
              <AiFeedbackMarkdown
                text={aiFeedback}
                className="text-xs leading-relaxed text-[var(--cc-text)] [&_.prose]:text-xs"
              />
            </div>
          ) : null}
          {hasDetails ? <ClassroomPointHistoryDetail point={point} /> : null}
        </div>
      ) : null}
    </div>
  )
}
