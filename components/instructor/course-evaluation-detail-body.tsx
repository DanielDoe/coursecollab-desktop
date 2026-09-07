"use client"

import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { CourseEvaluationSurveySummary } from "@/components/instructor/course-evaluation-survey-summary"
import { CourseEvaluationProofPreview } from "@/components/course-evaluation-proof-preview"
import {
  gradeMismatch,
  STATUS_LABELS,
  type EvaluationRow,
  type Proof,
} from "@/components/instructor/course-evaluation-shared"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  CE_LABEL,
  CE_PANEL,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
  ceStatusPillClass,
} from "@/lib/course-evaluations/course-evaluation-surface-classes"
import { cn } from "@/lib/utils"

export function CourseEvaluationDetailBody({
  selected,
  proofs,
  note,
  onNoteChange,
  acting,
  showActions,
  onApprove,
  onReject,
}: {
  selected: EvaluationRow
  proofs: Proof[]
  note: string
  onNoteChange: (v: string) => void
  acting?: boolean
  showActions?: boolean
  onApprove?: () => void
  onReject?: () => void
}) {
  const chrome = facultyEmbedChrome("course-evaluations")
  const statusLabel = STATUS_LABELS[selected.status] ?? selected.status

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] pb-3">
        <div>
          <p className={cn("text-lg font-semibold", PORTAL_TEXT)}>{selected.full_name}</p>
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            {selected.student_code} · {selected.section}
          </p>
        </div>
        <span className={ceStatusPillClass(selected.status)}>{statusLabel}</span>
      </div>

      <CourseEvaluationSurveySummary data={selected} />

      <div className={cn(CE_PANEL, "space-y-2")}>
        <p className={CE_LABEL}>Pass expectation</p>
        <div className={cn("flex flex-wrap gap-3 text-sm", PORTAL_TEXT)}>
          <div>
            <span className={PORTAL_TEXT_MUTED}>Student&apos;s pass goal: </span>
            <strong>{selected.self_assessed_letter_grade || "—"}</strong>
          </div>
          <div>
            <span className={PORTAL_TEXT_MUTED}>Current standing: </span>
            <strong>
              {selected.actual_letter_grade || "—"}
              {selected.actual_total_score != null
                ? ` (${Number(selected.actual_total_score).toFixed(1)}%)`
                : ""}
            </strong>
          </div>
        </div>
        {gradeMismatch(selected.self_assessed_letter_grade, selected.actual_letter_grade) ? (
          <p className="text-xs text-[var(--cc-sem-warning)]">
            Pass expectation differs from current gradebook standing.
          </p>
        ) : null}
      </div>

      <div className={cn(CE_PANEL, "space-y-2")}>
        <p className={CE_LABEL}>Canvas evaluation proof</p>
        {proofs.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {proofs.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block overflow-hidden rounded-xl border border-[var(--border)] bg-muted/30"
              >
                <div className="relative aspect-video">
                  <CourseEvaluationProofPreview
                    url={p.url}
                    fileName={p.file_name}
                    mime={p.mime}
                    compact
                  />
                </div>
                <p
                  className={cn(
                    "truncate px-2 py-1.5 text-xs group-hover:text-[var(--cc-accent-dark)]",
                    PORTAL_TEXT_MUTED,
                  )}
                >
                  {p.file_name || "View proof"} — open full size
                </p>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--cc-sem-warning)]">No Canvas proof files uploaded.</p>
        )}
      </div>

      {showActions && selected.status === "pending" ? (
        <>
          <Textarea
            placeholder="Optional note to student (especially if returning)"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={2}
            className="rounded-lg border-[var(--border)] bg-[var(--card)] shadow-none"
          />
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
            <Button
              disabled={acting}
              onClick={onReject}
              className={cn("sm:flex-1", chrome.quiet)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Return to student
            </Button>
            <Button disabled={acting} onClick={onApprove} className={cn("sm:flex-1", chrome.success)}>
              {acting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Approve evaluation
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
