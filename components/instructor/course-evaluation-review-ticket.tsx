"use client"

import { CheckCircle2, ImageIcon, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { gradeMismatch, type EvaluationRow } from "@/components/instructor/course-evaluation-shared"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"
import {
  CE_ROW,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/course-evaluations/course-evaluation-surface-classes"
import { cn } from "@/lib/utils"

function rowInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
}

function formatSubmitted(iso?: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export function CourseEvaluationReviewTicket({
  row,
  index = 0,
  actingAction,
  onOpen,
  onApprove,
  onReturn,
}: {
  row: EvaluationRow
  index?: number
  actingAction?: "approve" | "reject" | null
  onOpen: () => void
  onApprove: () => void
  onReturn: () => void
}) {
  const chrome = facultyEmbedChrome("course-evaluations")
  const stripe = portalListStripe(index, chrome.theme.family)
  const submitted = formatSubmitted(row.submitted_at)
  const proofCount = row.proof_count ?? 0
  const isMismatch = gradeMismatch(row.self_assessed_letter_grade, row.actual_letter_grade)
  const isActing = Boolean(actingAction)

  return (
    <div className={cn(CE_ROW, "flex-wrap")}>
      <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
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
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>{row.full_name}</p>
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                {row.student_code} · {row.section}
                {submitted ? ` · ${submitted}` : ""}
              </p>
            </div>
            <span className="rounded-md bg-[var(--cc-sem-warning)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--cc-sem-warning)]">
              Waiting
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className={cn("inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5", PORTAL_TEXT_MUTED)}>
              <ImageIcon className="h-3 w-3 shrink-0 opacity-70" />
              {proofCount} proof{proofCount === 1 ? "" : "s"}
            </span>
            {row.self_assessed_letter_grade ? (
              <span className="rounded-md bg-[var(--cc-accent-soft)] px-2 py-0.5 text-[var(--cc-accent-dark)]">
                Goal {row.self_assessed_letter_grade}
              </span>
            ) : null}
            {row.actual_letter_grade ? (
              <span className="rounded-md bg-muted px-2 py-0.5 text-[var(--cc-text-muted)]">
                Now {row.actual_letter_grade}
              </span>
            ) : null}
            {isMismatch ? (
              <span className="rounded-md bg-[var(--cc-sem-warning)]/10 px-2 py-0.5 text-[var(--cc-sem-warning)]">
                Grade mismatch
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-wrap items-center gap-1.5 sm:w-auto sm:flex-col sm:items-stretch">
        <Button
          type="button"
          size="sm"
          disabled={isActing}
          onClick={onApprove}
          className={cn("h-8 gap-1 px-2.5 text-xs", chrome.success)}
        >
          {actingAction === "approve" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isActing}
          onClick={onReturn}
          className={cn("h-8 gap-1 px-2.5 text-xs", chrome.danger)}
        >
          {actingAction === "reject" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          Return
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isActing}
          onClick={onOpen}
          className={cn("h-8 px-2.5 text-xs", chrome.quiet)}
        >
          Open
        </Button>
      </div>
    </div>
  )
}
