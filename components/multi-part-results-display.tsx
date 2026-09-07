"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { QuestionMediaDisplay } from "@/components/question-media-display"
import {
  getGradableSubquestions,
  resolveMultiPartStudentAnswerForDisplay,
  subquestionOptionLabels,
  gradeSubPart,
} from "@/lib/multi-part-question"
import { SOLUTION_UPLOAD_PART_KEY } from "@/lib/multi-part-grading-policy"
import { subquestionAllowsSolutionUpload } from "@/lib/solution-upload"
import { SolutionUploadPreview } from "@/components/solution-upload-preview"

export function MultiPartResultsDisplay({
  question,
}: {
  question: {
    question_text?: string
    question_media?: unknown
    circuit_spec?: unknown
    subquestions?: unknown
    selected_answer?: string | null
    answer_data?: unknown
  }
}) {
  const subquestions = useMemo(
    () => getGradableSubquestions(question.subquestions),
    [question.subquestions],
  )

  const parsed = useMemo(
    () =>
      resolveMultiPartStudentAnswerForDisplay(
        question.selected_answer,
        question.answer_data,
        subquestions,
      ),
    [question.selected_answer, question.answer_data, subquestions],
  )

  const rootUpload = parsed.solution_uploads?.[SOLUTION_UPLOAD_PART_KEY] ?? null
  const hasAnyUpload =
    !!rootUpload?.url ||
    subquestions.some((sq) => !!parsed.solution_uploads?.[sq.id]?.url)

  if (subquestions.length === 0) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-300">
        Multi-part question: no sub-parts configured.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <QuestionMediaDisplay
        question={{
          question_media: question.question_media,
          circuit_spec: question.circuit_spec,
        }}
        size="compact"
      />

      {subquestions.map((sq) => {
        const labels = subquestionOptionLabels(sq)
        const submitted = parsed.parts[sq.id]
        const { fraction, isFullyCorrect } = gradeSubPart(sq, submitted)
        const isSelectAll = sq.type === "select_all"
        const selectedLetters = isSelectAll
          ? (Array.isArray(submitted) ? submitted : []).map((x) => String(x).toUpperCase())
          : [String(submitted ?? "").toUpperCase()].filter(Boolean)

        return (
          <div
            key={sq.id}
            className="rounded-xl border border-slate-200/80 dark:border-slate-600 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/30"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <span className="shrink-0 inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 text-xs font-bold px-1.5">
                  {sq.id}
                </span>
                <QuestionTextRenderer
                  text={sq.prompt}
                  className="text-sm font-medium leading-relaxed"
                />
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 rounded-full text-xs",
                  isFullyCorrect
                    ? "bg-emerald-100/80 text-emerald-700 border-emerald-300"
                    : fraction > 0
                      ? "bg-amber-100/80 text-amber-700 border-amber-300"
                      : "bg-red-100/80 text-red-700 border-red-300",
                )}
              >
                {isFullyCorrect ? (
                  <Check className="h-3 w-3 mr-1" />
                ) : (
                  <X className="h-3 w-3 mr-1" />
                )}
                {isFullyCorrect ? "Correct" : fraction > 0 ? "Partial" : "Incorrect"}
              </Badge>
            </div>

            <ul className="space-y-2">
              {labels.map(({ letter, text }) => {
                const isSelected = selectedLetters.includes(letter.toUpperCase())
                const isCorrect =
                  isSelectAll
                    ? (sq.correct_answers ?? []).map((x) => x.toUpperCase()).includes(letter.toUpperCase())
                    : sq.correct_answer?.toUpperCase() === letter.toUpperCase()

                return (
                  <li
                    key={letter}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                      isCorrect && isSelected
                        ? "border-emerald-400 bg-emerald-50/90 dark:bg-emerald-950/30"
                        : isCorrect
                          ? "border-blue-300 bg-blue-50/80 dark:bg-blue-950/25"
                          : isSelected
                            ? "border-red-300 bg-red-50/80 dark:bg-red-950/25"
                            : "border-slate-200 dark:border-slate-600 bg-white/60 dark:bg-slate-900/20",
                    )}
                  >
                    <span className="font-bold shrink-0">{letter}.</span>
                    <QuestionTextRenderer
                      text={text}
                      className="flex-1 min-w-0 text-sm leading-relaxed [&_div]:mb-0"
                    />
                    {isSelected ? (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        Yours
                      </Badge>
                    ) : null}
                    {isCorrect ? (
                      <Badge variant="outline" className="text-[10px] shrink-0 bg-blue-100">
                        Correct
                      </Badge>
                    ) : null}
                  </li>
                )
              })}
            </ul>

            {(() => {
              const partUpload = parsed.solution_uploads?.[sq.id]
              if (!partUpload?.url) return null
              return (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">
                    Part {sq.id} — worked solution upload
                  </p>
                  <SolutionUploadPreview upload={partUpload} />
                </div>
              )
            })()}
          </div>
        )
      })}

      {rootUpload?.url ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Worked solution upload</p>
          <SolutionUploadPreview upload={rootUpload} />
        </div>
      ) : null}

      {!hasAnyUpload &&
      subquestions.some((sq) => subquestionAllowsSolutionUpload(sq)) ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 italic">
          No worked solution was uploaded for this question.
        </p>
      ) : null}
    </div>
  )
}
