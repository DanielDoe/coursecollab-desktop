"use client"

import Link from "next/link"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Flag,
  Grid3x3,
  ListChecks,
  Sparkles,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { QuestionSection } from "@/lib/assessment-sections"
import { cn } from "@/lib/utils"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/assessments/assessment-management-surface-classes"
import { Skeleton } from "@/components/ui/skeleton"

const PURPLE = "#582c83"

/** Readable secondary copy on faculty embed surfaces (dark themes). */
const EMBED_BODY = "text-[var(--cc-text-secondary)]"
const EMBED_LABEL = "text-[var(--cc-text-secondary)]/90"
const EMBED_STAT_BOX =
  "flex flex-col rounded-xl border border-[var(--border)] bg-[var(--muted)]/50 px-4 py-3"

function accentColor(embedded?: boolean) {
  return embedded ? "var(--cc-accent)" : PURPLE
}

export function assessmentPreviewLabel(type: string): string {
  switch (type) {
    case "homework":
      return "Homework"
    case "mid_semester":
    case "mid-semester":
      return "Mid-Semester Exam"
    case "final":
    case "finals":
      return "Final Exam"
    default:
      return "Quiz"
  }
}

export function QuizPreviewBackLink({
  backUrl,
  label,
  shortLabel = "Back",
  className,
  embedded,
  variant = "button",
}: {
  backUrl: string
  label: string
  shortLabel?: string
  className?: string
  embedded?: boolean
  variant?: "button" | "inline"
}) {
  return (
    <Link
      href={backUrl}
      className={cn(
        variant === "inline"
          ? cn(
              "inline-flex shrink-0 items-center gap-1 text-sm font-medium transition-colors",
              embedded
                ? "text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)]"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
            )
          : embedded
            ? "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-muted/40 px-2 py-1.5 text-sm font-medium text-[var(--cc-text)] transition-colors hover:bg-muted/60"
            : "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-white",
        className,
      )}
    >
      <ArrowLeft className={cn("shrink-0", variant === "inline" ? "size-3.5" : "size-4")} aria-hidden />
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden whitespace-nowrap sm:inline">{label}</span>
    </Link>
  )
}

export function QuizPreviewLoading({ embedded }: { embedded?: boolean }) {
  if (embedded) {
    return (
      <div className="flex min-h-[50vh] flex-col gap-3 py-8">
        <Skeleton className="h-10 w-full max-w-md rounded-xl" />
        <Skeleton className="h-64 w-full max-w-lg rounded-xl" />
      </div>
    )
  }
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        embedded ? "min-h-[50vh]" : "py-16",
      )}
    >
      <div className="size-9 animate-spin rounded-full border-2 border-[#582c83] border-t-transparent" />
      <p className="text-sm text-slate-500 dark:text-slate-400">Loading preview…</p>
    </div>
  )
}

export function QuizPreviewInstructions({
  title,
  description,
  questionCount,
  assessmentLabel,
  timePerQuestion,
  backUrl,
  onStart,
  embedded,
}: {
  title: string
  description?: string
  questionCount: number
  assessmentLabel: string
  timePerQuestion?: number | null
  backUrl: string
  onStart: () => void
  embedded?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        embedded ? "min-h-[calc(100dvh-4rem)] bg-[var(--background)] px-4 py-8" : "min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 px-4 py-10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800",
      )}
    >
      <div className="w-full max-w-lg">
        <div className={cn("overflow-hidden rounded-2xl", embedded ? PORTAL_CARD : "border border-slate-200/80 bg-white shadow-xl shadow-violet-900/5 dark:border-slate-700 dark:bg-slate-900")}>
          <div className={cn("border-b px-6 py-5", embedded ? "border-[var(--border)] bg-[var(--muted)]/40" : "border-slate-100 bg-gradient-to-r from-[#582c83]/10 via-violet-50 to-amber-50 dark:border-slate-800 dark:from-[#582c83]/20 dark:via-slate-900 dark:to-slate-900")}>
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider", embedded ? "border-[var(--cc-accent)]/25 bg-[var(--cc-accent)]/10 text-[var(--cc-accent)]" : "border-[#582c83]/20 bg-white/80 text-[#582c83] dark:bg-slate-800")}>
                  <Eye className="size-3.5" />
                  Student preview
                </span>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] font-semibold uppercase",
                    embedded && "border-[var(--border)] bg-[var(--muted)] text-[var(--cc-text-secondary)]",
                  )}
                >
                  {assessmentLabel}
                </Badge>
              </div>
            </div>
            <h1 className={cn("text-xl font-bold tracking-tight sm:text-2xl", embedded ? PORTAL_TEXT : "text-slate-900 dark:text-white")}>
              {title}
            </h1>
            {description ? (
              <p className={cn("mt-2 text-sm leading-relaxed", embedded ? EMBED_BODY : "text-slate-600 dark:text-slate-300")}>
                {description}
              </p>
            ) : null}
          </div>

          <div className="space-y-5 px-6 py-6">
            <p className={cn("text-sm leading-relaxed", embedded ? EMBED_BODY : "text-slate-600 dark:text-slate-300")}>
              Walk through exactly what students see — answer questions, test timers, and view
              scores. Nothing is saved to the gradebook.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className={embedded ? EMBED_STAT_BOX : "rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50"}>
                <p className={cn("text-[11px] font-semibold uppercase tracking-wide", embedded ? EMBED_LABEL : "text-slate-500")}>
                  Questions
                </p>
                <p className={cn("mt-1 text-2xl font-bold tabular-nums", embedded ? PORTAL_TEXT : "text-slate-900 dark:text-white")}>
                  {questionCount}
                </p>
              </div>
              <div className={embedded ? EMBED_STAT_BOX : "rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50"}>
                <p className={cn("text-[11px] font-semibold uppercase tracking-wide", embedded ? EMBED_LABEL : "text-slate-500")}>
                  Default timer
                </p>
                <p className={cn("mt-1 text-2xl font-bold tabular-nums", embedded ? PORTAL_TEXT : "text-slate-900 dark:text-white")}>
                  {timePerQuestion ? `${timePerQuestion}s` : "—"}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={onStart}
                className={embedded ? "w-full bg-[var(--cc-accent)] text-white hover:opacity-90" : "w-full bg-[#582c83] hover:bg-[#4a2470]"}
              >
                <Sparkles className="mr-2 size-4" />
                Start preview
              </Button>
              <QuizPreviewBackLink
                backUrl={backUrl}
                label={`Back to ${assessmentLabel}`}
                variant="inline"
                className="self-center"
                embedded={embedded}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function QuizPreviewNavigator({
  questionCount,
  currentIndex,
  answeredQuestions,
  flaggedQuestions,
  sections,
  onNavigate,
  className,
  compact,
  embedded,
}: {
  questionCount: number
  currentIndex: number
  answeredQuestions: Set<number>
  flaggedQuestions: Set<number>
  sections: QuestionSection[]
  onNavigate: (index: number) => void
  className?: string
  compact?: boolean
  embedded?: boolean
}) {
  const accent = accentColor(embedded)
  const renderButton = (idx: number) => {
    const isAnswered = answeredQuestions.has(idx)
    const isFlagged = flaggedQuestions.has(idx)
    const isCurrent = idx === currentIndex

    return (
      <button
        key={idx}
        type="button"
        onClick={() => onNavigate(idx)}
        className={cn(
          "relative flex aspect-square min-w-[36px] items-center justify-center rounded-lg text-sm font-semibold transition-all",
          compact ? "max-w-[40px]" : "max-w-[44px]",
          isCurrent
            ? embedded
              ? "bg-[var(--cc-accent)] text-white shadow-md ring-2 ring-[var(--cc-accent)]/30 ring-offset-1"
              : "bg-[#582c83] text-white shadow-md ring-2 ring-[#582c83]/30 ring-offset-1"
            : isAnswered
              ? "border border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : embedded
                ? "border border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)] hover:border-[var(--cc-accent)]/30"
                : "border border-slate-200 bg-white text-slate-700 hover:border-[#582c83]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
        )}
      >
        {idx + 1}
        {isFlagged ? (
          <Flag className="absolute -right-1 -top-1 size-3 fill-amber-500 text-amber-500" />
        ) : null}
      </button>
    )
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Grid3x3 className={cn("size-4", embedded ? "text-[var(--cc-accent)]" : "text-[#582c83]")} />
          <span className={cn("text-sm font-semibold", embedded ? PORTAL_TEXT : "text-slate-800 dark:text-slate-100")}>
            Questions
          </span>
        </div>
        <span className={cn("text-xs font-medium tabular-nums", embedded ? PORTAL_TEXT_MUTED : "text-slate-500")}>
          {answeredQuestions.size}/{questionCount} answered
        </span>
      </div>

      <div className={cn("h-1.5 overflow-hidden rounded-full", embedded ? "bg-muted" : "bg-slate-200 dark:bg-slate-700")}>
        <div
          className={cn("h-full rounded-full transition-all duration-300", embedded ? "bg-[var(--cc-accent)]" : "bg-gradient-to-r from-[#582c83] to-violet-500")}
          style={{ width: `${((currentIndex + 1) / questionCount) * 100}%` }}
        />
      </div>

      {sections.length > 0 ? (
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.sectionIndex} className="space-y-2">
              <p className={cn("text-[11px] font-semibold uppercase tracking-wide", embedded ? PORTAL_TEXT_MUTED : "text-slate-500")}>
                {section.title}
                {section.weightPercent > 0 ? ` · ${section.weightPercent}%` : ""}
              </p>
              <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
                {section.questionIndices.map(renderButton)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
          {Array.from({ length: questionCount }, (_, idx) => renderButton(idx))}
        </div>
      )}

      <div className={cn("flex flex-wrap gap-3 text-[11px]", embedded ? PORTAL_TEXT_MUTED : "text-slate-500")}>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: accent }} /> Current
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" /> Answered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Flag className="size-3 text-amber-500" /> Flagged
        </span>
      </div>
    </div>
  )
}

export function QuizPreviewToolbar({
  title,
  assessmentLabel,
  currentIndex,
  questionCount,
  timeLeft,
  isTimerActive,
  isFlagged,
  showNavigator,
  backUrl,
  onToggleFlag,
  onToggleNavigator,
  onComplete,
  embedded,
}: {
  title: string
  assessmentLabel: string
  currentIndex: number
  questionCount: number
  timeLeft: number
  isTimerActive: boolean
  isFlagged: boolean
  showNavigator: boolean
  backUrl: string
  onToggleFlag: () => void
  onToggleNavigator: () => void
  onComplete: () => void
  embedded?: boolean
}) {
  return (
    <div className={cn("sticky top-0 z-20 border-b backdrop-blur-md", embedded ? "border-[var(--border)] bg-[var(--card)]/95" : "border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/95")}>
      <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <QuizPreviewBackLink
          backUrl={backUrl}
          label={`Back to ${assessmentLabel}`}
          embedded={embedded}
        />

        <div className={cn("hidden h-8 w-px shrink-0 sm:block", embedded ? "bg-[var(--border)]" : "bg-slate-200 dark:bg-slate-700")} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Badge
              variant="outline"
              className={embedded ? "border-[var(--cc-accent)]/25 bg-[var(--cc-accent)]/5 text-[10px] font-bold uppercase tracking-wide text-[var(--cc-accent)]" : "border-[#582c83]/25 bg-[#582c83]/5 text-[10px] font-bold uppercase tracking-wide text-[#582c83]"}
            >
              <Eye className="mr-1 size-3" />
              Preview
            </Badge>
            <span className={cn("hidden text-[11px] font-semibold uppercase tracking-wide sm:inline", embedded ? PORTAL_TEXT_MUTED : "text-slate-500")}>
              {assessmentLabel}
            </span>
          </div>
          <p className={cn("truncate text-sm font-semibold sm:text-base", embedded ? PORTAL_TEXT : "text-slate-900 dark:text-white")}>
            {title}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm",
              timeLeft <= 10 && isTimerActive
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
            )}
          >
            <Clock className="size-3.5 shrink-0 sm:size-4" />
            {timeLeft}s
          </div>

          <Badge variant="secondary" className="hidden tabular-nums md:inline-flex">
            Q{currentIndex + 1}/{questionCount}
          </Badge>

          <Button
            type="button"
            variant={isFlagged ? "default" : "outline"}
            size="icon"
            onClick={onToggleFlag}
            className={cn("size-8 shrink-0 sm:size-9", isFlagged ? "bg-amber-500 hover:bg-amber-600" : "")}
            aria-label={isFlagged ? "Unflag question" : "Flag question"}
          >
            <Flag className="size-4" />
          </Button>

          <Button
            type="button"
            variant={showNavigator ? "secondary" : "outline"}
            size="icon"
            className="size-8 shrink-0 lg:hidden sm:size-9"
            onClick={onToggleNavigator}
            aria-label={showNavigator ? "Hide question list" : "Show question list"}
          >
            <Grid3x3 className="size-4" />
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onComplete}
            className="hidden h-8 px-2.5 text-xs sm:inline-flex sm:h-9 sm:px-3 sm:text-sm"
          >
            <ListChecks className="mr-1.5 size-4" />
            Results
          </Button>
        </div>
      </div>
    </div>
  )
}

export function QuizPreviewFeedbackPanel({
  feedback,
  isCorrect,
  isMultiSelect,
  correctAnswerText,
}: {
  feedback: {
    isCorrect: boolean
    explanation: string
    earnedPoints: number
    totalPoints: number
  } | null
  isCorrect: boolean
  isMultiSelect: boolean
  correctAnswerText: string
}) {
  const positive = feedback ? feedback.isCorrect : isCorrect

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3",
        positive
          ? "border-emerald-300/80 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-amber-300/80 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
      )}
    >
      {feedback ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {feedback.isCorrect ? (
              <CheckCircle2 className="size-5 text-emerald-600" />
            ) : (
              <XCircle className="size-5 text-amber-600" />
            )}
            <span className="font-semibold text-slate-900 dark:text-white">
              {feedback.isCorrect
                ? "Excellent"
                : feedback.earnedPoints > 0
                  ? "Partial credit"
                  : "Needs improvement"}{" "}
              · {feedback.earnedPoints}/{feedback.totalPoints} pts
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {feedback.explanation}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {isCorrect ? (
            <>
              <CheckCircle2 className="size-5 text-emerald-600" />
              <span className="font-semibold text-emerald-800 dark:text-emerald-300">Correct!</span>
            </>
          ) : (
            <>
              <XCircle className="size-5 text-red-600" />
              <span className="font-semibold text-red-800 dark:text-red-300">
                {isMultiSelect
                  ? "Incorrect — check the highlighted answers."
                  : `Incorrect — correct answer: ${correctAnswerText}`}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function QuizPreviewActionBar({
  isFirst,
  isLast,
  showFeedback,
  isTimerActive,
  isSubmitting,
  isTextInput,
  isCorrect,
  onPrevious,
  onNext,
  onStartTimer,
  onSubmit,
  onRetry,
  onNextAfterFeedback,
  onComplete,
}: {
  isFirst: boolean
  isLast: boolean
  showFeedback: boolean
  isTimerActive: boolean
  isSubmitting: boolean
  isTextInput: boolean
  isCorrect: boolean
  onPrevious: () => void
  onNext: () => void
  onStartTimer: () => void
  onSubmit: () => void
  onRetry: () => void
  onNextAfterFeedback: () => void
  onComplete: () => void
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
      <Button type="button" variant="outline" onClick={onPrevious} disabled={isFirst}>
        <ChevronLeft className="mr-1 size-4" />
        Previous
      </Button>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {!isTimerActive && !showFeedback ? (
          <Button type="button" variant="outline" size="sm" onClick={onStartTimer}>
            <Clock className="mr-1.5 size-4" />
            Start timer
          </Button>
        ) : null}

        {!showFeedback ? (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="bg-[#582c83] hover:bg-[#4a2470]"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Evaluating…
              </span>
            ) : (
              "Submit answer"
            )}
          </Button>
        ) : null}

        {showFeedback && isTextInput && !isCorrect ? (
          <Button type="button" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        ) : null}

        {showFeedback && !isLast ? (
          <Button type="button" onClick={onNextAfterFeedback} className="bg-[#582c83] hover:bg-[#4a2470]">
            Next question
            <ChevronRight className="ml-1 size-4" />
          </Button>
        ) : null}

        {showFeedback && isLast ? (
          <Button type="button" onClick={onComplete} className="bg-[#582c83] hover:bg-[#4a2470]">
            View results
          </Button>
        ) : null}
      </div>

      <Button type="button" variant="outline" onClick={onNext} disabled={isLast} className="hidden sm:inline-flex">
        Next
        <ChevronRight className="ml-1 size-4" />
      </Button>
    </div>
  )
}

export { PURPLE as QUIZ_PREVIEW_PURPLE }
