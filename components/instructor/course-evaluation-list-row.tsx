"use client"

import { CheckCircle2, ChevronRight, ImageIcon, Loader2 } from "lucide-react"
import { likertLabel, LIKERT_5, SURVEY_OTHER_OPTION } from "@/lib/course-evaluation-survey"
import { gradeMismatch, STATUS_LABELS, type EvaluationRow } from "@/components/instructor/course-evaluation-shared"
import { Button } from "@/components/ui/button"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"
import {
  CE_ROW,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
  ceStatusPillClass,
} from "@/lib/course-evaluations/course-evaluation-surface-classes"
import { cn } from "@/lib/utils"

function rowInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
}

export function CourseEvaluationListRow({
  row,
  index = 0,
  onSelect,
  onQuickApprove,
  quickApproving,
}: {
  row: EvaluationRow
  index?: number
  onSelect: () => void
  onQuickApprove?: (row: EvaluationRow) => void
  quickApproving?: boolean
}) {
  const chrome = facultyEmbedChrome("course-evaluations")
  const stripe = portalListStripe(index, chrome.theme.family)
  const statusLabel = STATUS_LABELS[row.status] ?? row.status
  const isPending = row.status === "pending"

  return (
    <div className={CE_ROW}>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-start gap-2.5 text-left sm:gap-3"
      >
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
            stripe.iconBg,
            stripe.iconText,
          )}
        >
          {rowInitials(row.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-2">
            <div className="min-w-0">
              <p className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>{row.full_name}</p>
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                {row.student_code} · {row.section}
              </p>
            </div>
            <div className="shrink-0 space-y-1 text-right">
              <span className={ceStatusPillClass(row.status)}>{statusLabel}</span>
              <p className={cn("text-xs font-medium tabular-nums", PORTAL_TEXT)}>
                {likertLabel(LIKERT_5, row.course_rating)}
              </p>
            </div>
          </div>
          {row.feature_to_improve ? (
            <p className={cn("mt-1 line-clamp-1 text-[11px]", PORTAL_TEXT_MUTED)}>
              Improve:{" "}
              {row.feature_to_improve === SURVEY_OTHER_OPTION && row.feature_to_improve_other?.trim()
                ? `Other — ${row.feature_to_improve_other.trim()}`
                : row.feature_to_improve}
            </p>
          ) : null}
          <p className={cn("mt-1.5 line-clamp-2 text-sm", PORTAL_TEXT_MUTED)}>
            {row.improvement_suggestions}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            {row.self_assessed_letter_grade ? (
              <span className="rounded-md bg-[var(--cc-accent-soft)] px-2 py-0.5 text-[var(--cc-accent-dark)]">
                Pass goal: {row.self_assessed_letter_grade}
              </span>
            ) : null}
            {row.actual_letter_grade ? (
              <span className="rounded-md bg-muted px-2 py-0.5 text-[var(--cc-text-muted)]">
                Current: {row.actual_letter_grade}
              </span>
            ) : null}
            {gradeMismatch(row.self_assessed_letter_grade, row.actual_letter_grade) ? (
              <span className="rounded-md bg-[var(--cc-sem-warning)]/10 px-2 py-0.5 text-[var(--cc-sem-warning)]">
                Mismatch
              </span>
            ) : null}
          </div>
          <p className={cn("mt-1.5 flex items-center gap-1 text-xs", PORTAL_TEXT_MUTED)}>
            <ImageIcon className="h-3 w-3 shrink-0 opacity-70" />
            {row.proof_count ?? 0} Canvas proof file{(row.proof_count ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
      </button>

      <div className="flex shrink-0 flex-col items-center justify-center gap-1 py-1 pl-1">
        {isPending && onQuickApprove ? (
          <Button
            type="button"
            size="sm"
            disabled={quickApproving}
            onClick={(e) => {
              e.stopPropagation()
              onQuickApprove(row)
            }}
            className={cn("h-8 gap-1 px-2.5 text-xs", chrome.success)}
          >
            {quickApproving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </>
            )}
          </Button>
        ) : null}
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "rounded-lg p-1.5 text-[var(--cc-text-muted)] transition-colors hover:bg-muted/50",
            chrome.accentIcon,
          )}
          aria-label="View full report"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
