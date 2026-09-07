"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  AM_LIST_ROW,
  AM_STAT_BOX,
  PORTAL_CARD,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
  amAccuracyPillClass,
  amDifficultyPillClass,
} from "@/lib/assessments/assessment-management-surface-classes"
import type { FacultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"
import { QuestionTextRenderer } from "@/components/question-text-renderer"

type QuestionRow = {
  question_id: number
  question_order: number
  question_text: string
  question_type: string
  difficulty_rating: string
  accuracy_rate: number
  total_attempts: number
  correct_count: number
  incorrect_count: number
  avg_time_spent: number
  common_wrong_answers?: Array<{ answer: string; count: number }>
}

function heatCellClass(accuracy: number, selected: boolean) {
  const base = "relative flex aspect-square min-h-9 flex-col items-center justify-center rounded-lg border text-center transition-all"
  const selectedRing = selected ? "ring-2 ring-[var(--cc-accent)] ring-offset-1 ring-offset-[var(--card)]" : ""
  if (accuracy >= 80) {
    return cn(base, selectedRing, "border-[var(--cc-sem-success)]/35 bg-[var(--cc-sem-success)]/18 hover:bg-[var(--cc-sem-success)]/28")
  }
  if (accuracy >= 50) {
    return cn(base, selectedRing, "border-[var(--cc-sem-warning)]/35 bg-[var(--cc-sem-warning)]/16 hover:bg-[var(--cc-sem-warning)]/26")
  }
  return cn(base, selectedRing, "border-[var(--cc-sem-danger)]/35 bg-[var(--cc-sem-danger)]/16 hover:bg-[var(--cc-sem-danger)]/26")
}

function heatLabel(accuracy: number) {
  if (accuracy >= 80) return "Strong"
  if (accuracy >= 50) return "Mixed"
  return "Hard"
}

export function QuestionDifficultyHeatmap({
  questions,
  embed,
  chrome,
}: {
  questions: QuestionRow[]
  embed?: boolean
  chrome?: FacultyEmbedChrome | null
}) {
  const ordered = useMemo(
    () => [...questions].sort((a, b) => a.question_order - b.question_order),
    [questions],
  )
  const hardestFirst = useMemo(
    () => [...questions].sort((a, b) => a.accuracy_rate - b.accuracy_rate),
    [questions],
  )

  const [selectedId, setSelectedId] = useState<number | null>(() => ordered[0]?.question_id ?? null)

  useEffect(() => {
    if (ordered.length === 0) return
    if (selectedId == null || !ordered.some((q) => q.question_id === selectedId)) {
      setSelectedId(ordered[0].question_id)
    }
  }, [ordered, selectedId])

  if (ordered.length === 0) return null

  const selected = ordered.find((q) => q.question_id === selectedId) ?? hardestFirst[0]
  const selectedStripe = embed && chrome ? portalListStripe(selected.question_order - 1, chrome.theme.family) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium uppercase tracking-wide">
          <span className="inline-flex items-center gap-1.5 text-[var(--cc-sem-success)]">
            <span className="size-2.5 rounded-sm border border-[var(--cc-sem-success)]/40 bg-[var(--cc-sem-success)]/25" />
            Strong 80%+
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--cc-sem-warning)]">
            <span className="size-2.5 rounded-sm border border-[var(--cc-sem-warning)]/40 bg-[var(--cc-sem-warning)]/20" />
            Mixed 50–79%
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--cc-sem-danger)]">
            <span className="size-2.5 rounded-sm border border-[var(--cc-sem-danger)]/40 bg-[var(--cc-sem-danger)]/18" />
            Hard &lt;50%
          </span>
        </div>
        <p className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>{ordered.length} questions</p>
      </div>

      <div
        className={cn(
          embed ? "rounded-xl border border-[var(--border)] bg-muted/15 p-3 sm:p-4" : "rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40",
        )}
      >
        <p className={cn("mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]", PORTAL_TEXT_MUTED)}>
          By question order
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5 sm:gap-2">
          {ordered.map((q) => {
            const isSelected = selectedId === q.question_id
            return (
              <button
                key={q.question_id}
                type="button"
                title={`Q${q.question_order}: ${q.accuracy_rate}% accurate · ${heatLabel(q.accuracy_rate)}`}
                onClick={() => setSelectedId(q.question_id)}
                className={heatCellClass(q.accuracy_rate, isSelected)}
              >
                <span className={cn("text-[10px] font-bold leading-none", PORTAL_TEXT_MUTED)}>Q{q.question_order}</span>
                <span className={cn("mt-0.5 text-[11px] font-semibold tabular-nums leading-none", PORTAL_TEXT)}>
                  {Math.round(q.accuracy_rate)}%
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div
        className={cn(
          embed ? "rounded-xl border border-[var(--border)] bg-muted/15 p-3 sm:p-4" : "rounded-xl border border-slate-200 p-4 dark:border-slate-700",
        )}
      >
        <p className={cn("mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]", PORTAL_TEXT_MUTED)}>
          Hardest questions first
        </p>
        <div className="flex flex-wrap gap-1.5">
          {hardestFirst.slice(0, 12).map((q, i) => (
            <button
              key={`hard-${q.question_id}`}
              type="button"
              onClick={() => setSelectedId(q.question_id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums transition-colors",
                selectedId === q.question_id
                  ? "border-[var(--cc-accent)] bg-[var(--cc-accent)]/10 text-[var(--cc-accent)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text-muted)] hover:bg-[var(--cc-accent-soft)]/45",
              )}
            >
              Q{q.question_order}
              <span className="opacity-80">{Math.round(q.accuracy_rate)}%</span>
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div className={cn(embed ? PORTAL_CARD : "rounded-xl border border-slate-200 p-4 dark:border-slate-700", "overflow-hidden")}>
          <div className={cn(AM_LIST_ROW, "items-start gap-3 border-b border-[var(--border)]")}>
            {selectedStripe ? (
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                  selectedStripe.iconBg,
                  selectedStripe.iconText,
                )}
              >
                Q{selected.question_order}
              </div>
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
                Q{selected.question_order}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={amDifficultyPillClass(selected.difficulty_rating)}>
                  {selected.difficulty_rating?.replace("_", " ") || "medium"}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {selected.question_type}
                </Badge>
                <span className={cn(amAccuracyPillClass(selected.accuracy_rate), "tabular-nums")}>
                  {heatLabel(selected.accuracy_rate)} · {selected.accuracy_rate}%
                </span>
              </div>
              <QuestionTextRenderer
                text={selected.question_text}
                questionId={selected.question_id}
                className={cn("text-sm leading-snug [&_.prose]:text-[var(--cc-text)]", PORTAL_TEXT)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 sm:p-4">
            {[
              { label: "Attempts", value: selected.total_attempts },
              { label: "Correct", value: selected.correct_count },
              { label: "Wrong", value: selected.incorrect_count },
              { label: "Avg sec", value: selected.avg_time_spent },
            ].map(({ label, value }) => (
              <div key={label} className={AM_STAT_BOX}>
                <p className={cn("text-[10px] uppercase tracking-wide", PORTAL_TEXT_MUTED)}>{label}</p>
                <p className={cn("text-base font-semibold tabular-nums", PORTAL_TEXT)}>{value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 px-3 pb-3 sm:px-4 sm:pb-4">
            <div className="flex items-center justify-between text-xs">
              <span className={cn("font-medium", PORTAL_TEXT_MUTED)}>Class accuracy</span>
              <span className={cn("font-semibold tabular-nums", PORTAL_TEXT)}>{selected.accuracy_rate}%</span>
            </div>
            <Progress value={selected.accuracy_rate} className="h-2 bg-muted [&>div]:bg-[var(--cc-accent)]" />
          </div>

          {selected.common_wrong_answers && selected.common_wrong_answers.length > 0 ? (
            <div className="border-t border-[var(--border)] px-3 py-3 sm:px-4">
              <p className={cn("mb-2 text-[10px] font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                Common wrong answers
              </p>
              <div className="space-y-1.5">
                {selected.common_wrong_answers.slice(0, 3).map((wrong, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-muted/20 px-2.5 py-1.5 text-xs">
                    <div className={cn("min-w-0 flex-1 line-clamp-2", PORTAL_TEXT)}>
                      <QuestionTextRenderer text={wrong.answer} className="text-xs leading-snug" />
                    </div>
                    <Badge variant="outline" className="shrink-0 tabular-nums">
                      {wrong.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
