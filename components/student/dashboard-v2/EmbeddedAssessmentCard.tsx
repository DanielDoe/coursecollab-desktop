"use client"

import { AssessmentActionButtons } from "@/components/assessment-action-buttons"
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Timer,
  Zap,
  AlertCircle,
  Pause,
  ClipboardList,
  GraduationCap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { stripAssessmentInstructions } from "@/lib/student-assessment-hub"
import { isSingleSittingExamAssessmentDbType } from "@/lib/final-exam-policy"

export interface EmbeddedAssessmentQuiz {
  id: number
  title: string
  is_active: boolean
  time_per_question: number
  question_count: number
  attempted: boolean
  attempt_id?: number
  completed?: boolean
  quiz_type: "admin" | "practice"
  saved_for_later?: boolean
  can_take?: boolean
  calendar_retake_perks_expired?: boolean
  expired_retake_slots?: number | null
  attempts_remaining?: number | null
  can_apply_rollover?: boolean
  rollover_requires_upgrade?: boolean
  rollover_active?: boolean
  available_from?: string | null
  available_until?: string | null
  created_at?: string | null
  description?: string | null
  session_access_active?: boolean
  calendar_open?: boolean
  semester_assessments_closed?: boolean
  final_access_pending_allowlist?: boolean
  timer_display_label?: string
  can_retake?: boolean
  display_percentage?: number
  score?: number
  total_questions?: number
}

interface EmbeddedAssessmentCardProps {
  quiz: EmbeddedAssessmentQuiz
  assessmentLabel: string
  assessmentType?: string
  startGradient: string
  formatDate: (value: string | null | undefined) => string
  displayPercent: number | null
  isClosed: boolean
  isBeforeOpen: boolean
  viewMode?: "grid" | "list"
  onViewReport?: () => void
  onRetake?: () => void
  onContinue?: () => void
  onExtend?: () => void
  extending?: boolean
  extendLabel?: string
  onStart?: () => void
  startLabel?: string
  onLockedInfo?: () => void
  lockedLabel?: string
  show: {
    report?: boolean
    retake?: boolean
    continue?: boolean
    extend?: boolean
    start?: boolean
    closed?: boolean
    locked?: boolean
  }
}

function statusMeta(quiz: EmbeddedAssessmentQuiz, isClosed: boolean, isBeforeOpen: boolean) {
  if (quiz.saved_for_later) {
    return { label: "In progress", color: "var(--cc-accent)", icon: Clock }
  }
  if (quiz.attempted && quiz.completed) {
    return { label: "Completed", color: "var(--cc-success)", icon: CheckCircle2 }
  }
  if (quiz.rollover_active) {
    return { label: "Extension active", color: "var(--cc-warning)", icon: Timer }
  }
  if (quiz.final_access_pending_allowlist && quiz.is_active) {
    return { label: "Access pending", color: "var(--cc-warning)", icon: AlertCircle }
  }
  if (quiz.is_active) {
    return { label: "Active", color: "var(--cc-accent)", icon: Zap }
  }
  if (quiz.can_apply_rollover || quiz.rollover_requires_upgrade) {
    return { label: "Past due", color: "var(--cc-warning)", icon: Timer }
  }
  if (isClosed) {
    return { label: "Closed", color: "var(--cc-danger)", icon: AlertCircle }
  }
  if (quiz.session_access_active === false) {
    return { label: "Inactive", color: "var(--cc-text-muted)", icon: Pause }
  }
  if (isBeforeOpen) {
    return { label: "Opens soon", color: "var(--cc-text-muted)", icon: Calendar }
  }
  return { label: "Inactive", color: "var(--cc-text-muted)", icon: Pause }
}

function scoreColor(displayPercent: number) {
  if (displayPercent >= 70) return "var(--cc-success)"
  if (displayPercent >= 50) return "var(--cc-warning)"
  return "var(--cc-danger)"
}

function typeIcon(assessmentType?: string) {
  if (assessmentType === "homework") return BookOpen
  if (assessmentType === "final") return GraduationCap
  if (assessmentType === "mid_semester") return ClipboardList
  return ClipboardList
}

export function EmbeddedAssessmentCard({
  quiz,
  assessmentLabel,
  assessmentType,
  startGradient,
  formatDate,
  displayPercent,
  isClosed,
  isBeforeOpen,
  viewMode = "list",
  onViewReport,
  onRetake,
  onContinue,
  onExtend,
  extending,
  extendLabel,
  onStart,
  startLabel,
  onLockedInfo,
  lockedLabel,
  show,
}: EmbeddedAssessmentCardProps) {
  const status = statusMeta(quiz, isClosed, isBeforeOpen)
  const StatusIcon = status.icon
  const TypeIcon = typeIcon(assessmentType)
  const dueLabel = quiz.available_until ? formatDate(quiz.available_until) : null
  const instructionSnippet = stripAssessmentInstructions(quiz.description)
  const hasScore = quiz.attempted && quiz.completed && displayPercent != null
  const isSingleSitting = isSingleSittingExamAssessmentDbType(assessmentType)
  const retakeNote =
    isSingleSitting || quiz.can_retake !== true
      ? null
      : quiz.calendar_retake_perks_expired
        ? quiz.expired_retake_slots != null && quiz.expired_retake_slots > 0
          ? `${quiz.expired_retake_slots} retake${quiz.expired_retake_slots !== 1 ? "s" : ""} expired`
          : "Retakes expired"
        : quiz.attempts_remaining != null && quiz.attempts_remaining > 0
          ? `${quiz.attempts_remaining} retake${quiz.attempts_remaining !== 1 ? "s" : ""} left`
          : null

  const actionCount = [
    show.continue,
    show.report,
    show.retake,
    show.extend,
    show.start,
    show.closed,
    show.locked,
  ].filter(Boolean).length

  const actions = actionCount > 0 ? (
    <AssessmentActionButtons
      layout="horizontal"
      align="right"
      compact
      retakeAppearance="neutral"
      assessmentLabel={assessmentLabel}
      startGradient={startGradient}
      onViewReport={onViewReport}
      onRetake={onRetake}
      onContinue={onContinue}
      onExtend={onExtend}
      extending={extending}
      extendLabel={extendLabel}
      onStart={onStart}
      startLabel={startLabel}
      onLockedInfo={onLockedInfo}
      lockedLabel={lockedLabel}
      show={show}
      fullWidthMobile={viewMode === "list"}
    />
  ) : null

  const score =
    hasScore && displayPercent != null ? (
      <span
        className="shrink-0 text-base font-semibold tabular-nums sm:text-lg"
        style={{ color: scoreColor(displayPercent) }}
      >
        {displayPercent}%
      </span>
    ) : null

  if (viewMode === "grid") {
    return (
      <article className="flex h-full w-full flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--cc-accent)", color: "#FFFFFF" }}
          >
            <TypeIcon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--cc-text)]">
                {quiz.title}
              </h3>
              {score}
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--cc-text-muted)]">
              {quiz.quiz_type === "admin" ? (
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Official
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1" style={{ color: status.color }}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </span>
              <span>
                {quiz.question_count} Q · {quiz.timer_display_label ?? `${quiz.time_per_question}s`}
                {dueLabel ? ` · Due ${dueLabel}` : ""}
              </span>
            </p>
            {instructionSnippet ? (
              <p className="line-clamp-2 text-xs text-[var(--cc-text-muted)]">{instructionSnippet}</p>
            ) : null}
            {retakeNote ? (
              <p
                className="text-[11px] font-medium"
                style={{
                  color: quiz.calendar_retake_perks_expired ? "var(--cc-warning)" : "var(--cc-success)",
                }}
              >
                {retakeNote}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="mt-auto border-t border-[var(--border)] pt-3 [&>div]:flex [&>div]:w-full [&>div]:flex-wrap [&>div]:gap-1.5 [&_button]:h-9 [&_button]:min-w-0 [&_button]:flex-1 [&_button]:rounded-lg [&_button]:text-xs">
            {actions}
          </div>
        ) : null}
      </article>
    )
  }

  return (
    <article className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-lg sm:size-11 sm:rounded-xl"
            style={{ backgroundColor: "var(--cc-accent)", color: "#FFFFFF" }}
          >
            <TypeIcon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--cc-text)] sm:line-clamp-1">
              {quiz.title}
            </h3>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--cc-text-muted)]">
              {quiz.quiz_type === "admin" ? (
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Official
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1" style={{ color: status.color }}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </span>
              <span>
                {quiz.question_count} Q · {quiz.timer_display_label ?? `${quiz.time_per_question}s`}
                {dueLabel ? ` · Due ${dueLabel}` : ""}
              </span>
            </p>
            {retakeNote ? (
              <p
                className="text-[11px] font-medium"
                style={{
                  color: quiz.calendar_retake_perks_expired ? "var(--cc-warning)" : "var(--cc-success)",
                }}
              >
                {retakeNote}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] pt-3 lg:w-auto lg:flex-col lg:items-end lg:justify-center lg:border-0 lg:pt-0">
          {score}
          {actions ? (
            <div className="[&>div]:flex [&>div]:flex-wrap [&>div]:justify-end [&>div]:gap-1.5 [&_button]:h-8 [&_button]:rounded-lg [&_button]:px-3 [&_button]:text-xs sm:[&_button]:h-9">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
