"use client"

import { Flag, Grid3x3 } from "lucide-react"
import {
  shortSectionNavigatorTitle,
  type QuestionSection,
  type SectionConfig,
} from "@/lib/assessment-sections"
import { SectionPickNavigatorHint } from "@/components/section-question-pick-controls"
import type { SectionQuestionSelections } from "@/lib/section-pick-scoring"
import { cn } from "@/lib/utils"

type StudentQuizQuestionNavigatorProps = {
  questionCount: number
  currentQuestionIndex: number
  questions: { id: number }[]
  answeredQuestionIds: Set<number>
  flaggedQuestionIds: Set<number>
  sections: QuestionSection[]
  parsedSectionConfig: SectionConfig[] | null
  sectionQuestionSelections: SectionQuestionSelections
  onNavigate: (index: number) => void
  compact?: boolean
  className?: string
}

export function StudentQuizQuestionNavigator({
  questionCount,
  currentQuestionIndex,
  questions,
  answeredQuestionIds,
  flaggedQuestionIds,
  sections,
  parsedSectionConfig,
  sectionQuestionSelections,
  onNavigate,
  compact,
  className,
}: StudentQuizQuestionNavigatorProps) {
  const answeredCount = answeredQuestionIds.size
  const progressPct =
    questionCount > 0 ? Math.round(((currentQuestionIndex + 1) / questionCount) * 100) : 0

  const renderQuestionButton = (idx: number, q: { id: number }) => {
    const isAnswered = answeredQuestionIds.has(q.id)
    const isFlagged = flaggedQuestionIds.has(q.id)
    const isCurrent = idx === currentQuestionIndex
    const section = sections.find((s) => s.questionIndices.includes(idx))
    const isGradedPick =
      section != null
        ? (sectionQuestionSelections[section.sectionIndex]?.includes(q.id) ?? false)
        : false

    return (
      <button
        key={q.id}
        type="button"
        onClick={() => onNavigate(idx)}
        className={cn(
          "relative flex aspect-square min-w-[36px] items-center justify-center rounded-lg text-sm font-semibold transition-all",
          "hover:scale-[1.03] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)] focus-visible:ring-offset-1",
          compact ? "max-w-[40px]" : "max-w-[44px]",
          isCurrent
            ? "bg-[var(--cc-accent)] text-white shadow-md ring-2 ring-[var(--cc-accent)]/30 ring-offset-1"
            : isAnswered
              ? "border border-emerald-300/60 bg-emerald-500/10 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border border-amber-300/50 bg-[var(--muted)]/40 text-amber-800 dark:border-amber-700/50 dark:text-amber-300",
          isGradedPick && "ring-2 ring-violet-400/80",
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
        <div className="flex items-center gap-2 min-w-0">
          <Grid3x3 className="size-4 shrink-0 text-[var(--cc-accent)]" />
          <span className="text-sm font-semibold text-[var(--cc-text)]">Questions</span>
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--cc-text-muted)]">
          {answeredCount}/{questionCount}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
        <div
          className="h-full rounded-full bg-[var(--cc-accent)] transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {sections.length > 0 ? (
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.sectionIndex} className="space-y-2">
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                  {shortSectionNavigatorTitle(section.title)}
                  {section.weightPercent > 0 ? ` · ${section.weightPercent}%` : ""}
                </p>
                <SectionPickNavigatorHint
                  section={section}
                  sectionConfig={parsedSectionConfig}
                  selections={sectionQuestionSelections}
                />
              </div>
              <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
                {section.questionIndices.map((idx) => {
                  const q = questions[idx]
                  if (!q) return null
                  return renderQuestionButton(idx, q)
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
          {questions.map((q, idx) => renderQuestionButton(idx, q))}
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--cc-text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--cc-accent)]" /> Current
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" /> Answered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-500" /> Not yet
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Flag className="size-3 text-amber-500" /> Flagged
        </span>
      </div>
    </div>
  )
}
