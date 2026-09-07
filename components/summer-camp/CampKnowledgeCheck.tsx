"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, XCircle, ClipboardCheck, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { camperCta } from "@/lib/summer-camp/camper-ui-theme"
import { useCampPresentation } from "@/components/summer-camp/camp-presentation-context"
import { CAMP_PRESENTATION_SURFACE } from "@/lib/summer-camp/camp-presentation-styles"

export type CampQuizQuestion = {
  id: string
  prompt: string
  options: string[]
  correctIndex?: number
  correctIndices?: number[]
  multiSelect?: boolean
}

type CampKnowledgeCheckProps = {
  title: string
  questions: CampQuizQuestion[]
  initialAnswers?: Record<string, number | number[]>
  readOnly?: boolean
  saving?: boolean
  onSubmit: (answers: Record<string, number | number[]>) => Promise<void>
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"]

function arraysEqual(a: number[], b: number[]) {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

function isQuestionCorrect(q: CampQuizQuestion, selected: number | number[] | undefined): boolean {
  if (selected == null) return false
  if (q.multiSelect && q.correctIndices) {
    return Array.isArray(selected) && arraysEqual(selected, q.correctIndices)
  }
  if (typeof selected === "number" && q.correctIndex != null) {
    return selected === q.correctIndex
  }
  return false
}

export function CampKnowledgeCheck({
  title,
  questions,
  initialAnswers = {},
  readOnly,
  saving,
  onSubmit,
}: CampKnowledgeCheckProps) {
  const inPresentation = useCampPresentation()
  const [answers, setAnswers] = useState<Record<string, number | number[]>>(initialAnswers)
  const [submitted, setSubmitted] = useState(
    Object.keys(initialAnswers).length >= questions.length,
  )
  const [showResults, setShowResults] = useState(submitted)

  const answeredCount = useMemo(
    () =>
      questions.filter((q) => {
        const answer = answers[q.id]
        if (answer == null) return false
        if (q.multiSelect) return Array.isArray(answer) && answer.length > 0
        return true
      }).length,
    [answers, questions],
  )

  const correctCount = useMemo(
    () => questions.filter((q) => isQuestionCorrect(q, answers[q.id])).length,
    [answers, questions],
  )

  const allAnswered = answeredCount === questions.length

  const handleSubmit = async () => {
    if (!allAnswered) return
    await onSubmit(answers)
    setSubmitted(true)
    setShowResults(true)
  }

  return (
    <div
      className={cn(
        "rounded-2xl border overflow-hidden",
        inPresentation
          ? cn(CAMP_PRESENTATION_SURFACE, "border-slate-200 ring-1 ring-slate-200/80 shadow-lg")
          : "border-violet-500/25 bg-gradient-to-br from-violet-500/[0.06] via-white/40 to-indigo-500/[0.04] dark:from-violet-500/10 dark:via-white/[0.02]",
      )}
    >
      <div className={cn("px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b", inPresentation ? "border-slate-200" : "border-violet-500/15")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
              <ClipboardCheck className={cn("h-5 w-5", inPresentation ? "text-violet-600" : "text-violet-600 dark:text-violet-400")} />
            </div>
            <div>
              <p className={cn("text-xs font-semibold uppercase tracking-wider", inPresentation ? "text-violet-700" : "text-violet-600 dark:text-violet-400")}>
                Knowledge Check
              </p>
              <h3 className={cn("text-lg sm:text-xl font-bold mt-0.5", inPresentation ? "text-slate-900" : "text-slate-900 dark:text-white")}>
                {title}
              </h3>
            </div>
          </div>
          <div className="text-right">
            <p className={cn("text-xs", inPresentation ? "text-slate-500" : "text-slate-500")}>Progress</p>
            <p className={cn("text-sm font-bold", inPresentation ? "text-violet-800" : "text-violet-700 dark:text-violet-300")}>
              {answeredCount} / {questions.length} answered
            </p>
          </div>
        </div>
        <div className={cn("mt-4 h-1.5 rounded-full overflow-hidden", inPresentation ? "bg-slate-200/80" : "bg-slate-200/80 dark:bg-white/10")}>
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${(answeredCount / Math.max(questions.length, 1)) * 100}%` }}
            transition={{ duration: 0.35 }}
          />
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {questions.map((q, qIndex) => {
          const selected = answers[q.id]
          const isMulti = Boolean(q.multiSelect && q.correctIndices)
          const answered = selected != null && (isMulti ? (selected as number[]).length > 0 : true)
          const correct = showResults && isQuestionCorrect(q, selected)

          const toggleMulti = (idx: number) => {
            setAnswers((prev) => {
              const cur = (prev[q.id] as number[]) ?? []
              const next = cur.includes(idx) ? cur.filter((i) => i !== idx) : [...cur, idx]
              return { ...prev, [q.id]: next }
            })
            setShowResults(false)
          }

          return (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: qIndex * 0.05 }}
              className={cn(
                "rounded-xl border p-4 sm:p-5 space-y-4",
                inPresentation ? "bg-white border-slate-200/80" : "bg-white/70 dark:bg-white/[0.03]",
                showResults && correct && "border-emerald-500/40",
                showResults && answered && !correct && "border-red-500/30",
                !showResults && !inPresentation && "border-slate-200/80 dark:border-white/10",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--cc-accent)] text-white text-sm font-bold">
                  {qIndex + 1}
                </span>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className={cn("text-sm sm:text-base font-semibold leading-snug", inPresentation ? "text-slate-900" : "text-slate-900 dark:text-white")}>
                    {q.prompt}
                  </p>
                  {isMulti && (
                    <p className={cn("text-xs font-medium mt-1", inPresentation ? "text-violet-700" : "text-violet-600 dark:text-violet-400")}>
                      Select all that apply — choose every correct answer
                    </p>
                  )}
                </div>
                {showResults && answered && (
                  correct ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  )
                )}
              </div>

              <div className={cn("pl-11", isMulti ? "space-y-2" : "space-y-2.5")}>
                {q.options.map((opt, idx) => {
                  const letter = OPTION_LETTERS[idx] ?? String(idx + 1)
                  const isSelected = isMulti
                    ? Array.isArray(selected) && selected.includes(idx)
                    : selected === idx
                  const isCorrectAnswer = (q.correctIndices ?? []).includes(idx)
                  const isCorrectOption =
                    showResults &&
                    (isMulti ? isCorrectAnswer : q.correctIndex === idx)

                  const optionDisabled = readOnly || (submitted && showResults)
                  const optionClassName = cn(
                    "w-full text-left rounded-xl border-2 p-3.5 sm:p-4 transition-all duration-200",
                    isCorrectOption && "border-emerald-500 bg-emerald-500/10",
                    showResults && isSelected && !isCorrectOption && "border-red-500 bg-red-500/10",
                    !showResults && isSelected && "border-violet-500 bg-violet-500/10 shadow-sm",
                    !showResults &&
                      !isSelected &&
                      (inPresentation
                        ? "border-slate-200 hover:border-violet-400/60 hover:bg-violet-500/5"
                        : "border-slate-200 dark:border-slate-700 hover:border-violet-400/60 hover:bg-violet-500/5"),
                    optionDisabled && "cursor-default",
                  )

                  if (isMulti) {
                    const rowState = showResults
                      ? isSelected && isCorrectAnswer
                        ? "correct"
                        : isSelected && !isCorrectAnswer
                          ? "wrong"
                          : !isSelected && isCorrectAnswer
                            ? "missed"
                            : "neutral"
                      : isSelected
                        ? "selected"
                        : "neutral"

                    return (
                      <label
                        key={idx}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                          rowState === "selected" &&
                            "border-violet-400 bg-violet-50 dark:bg-violet-500/10",
                          rowState === "correct" &&
                            "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10",
                          rowState === "wrong" && "border-red-500 bg-red-50 dark:bg-red-500/10",
                          rowState === "missed" &&
                            "border-amber-500 bg-amber-50 dark:bg-amber-500/10",
                          rowState === "neutral" &&
                            "border-slate-200 bg-white dark:border-slate-700 dark:bg-white/[0.02]",
                          !optionDisabled && "cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.04]",
                          optionDisabled && "cursor-default",
                        )}
                      >
                        <Checkbox
                          id={`camp-kc-q${qIndex}-opt${idx}`}
                          checked={isSelected}
                          disabled={optionDisabled}
                          onCheckedChange={() => {
                            if (!optionDisabled) toggleMulti(idx)
                          }}
                          className={cn(
                            "mt-0.5 h-[18px] w-[18px] shrink-0 rounded-[3px] border-slate-400 bg-white shadow-none",
                            "data-[state=checked]:border-violet-600 data-[state=checked]:bg-violet-600 data-[state=checked]:text-white",
                            rowState === "correct" &&
                              "data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600",
                            rowState === "wrong" &&
                              "data-[state=checked]:border-red-600 data-[state=checked]:bg-red-600",
                          )}
                          aria-label={`Option ${letter}: ${opt}`}
                        />
                        <span className="min-w-0 flex-1 text-sm leading-relaxed text-slate-800 dark:text-slate-100">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {letter}.
                          </span>{" "}
                          {opt}
                          {showResults && rowState === "missed" && (
                            <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                              (correct)
                            </span>
                          )}
                        </span>
                      </label>
                    )
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={optionDisabled}
                      onClick={() => {
                        setAnswers((prev) => ({ ...prev, [q.id]: idx }))
                        setShowResults(false)
                      }}
                      className={optionClassName}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                            isCorrectOption && "border-emerald-500 bg-emerald-500 text-white",
                            showResults && isSelected && !isCorrectOption && "border-red-500 bg-red-500 text-white",
                            !showResults && isSelected && "border-violet-600 bg-violet-600 text-white",
                            !showResults &&
                              !isSelected &&
                              (inPresentation
                                ? "border-slate-300 text-slate-600"
                                : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"),
                          )}
                        >
                          {letter}
                        </span>
                        <span className={cn("text-sm sm:text-[15px] leading-relaxed", inPresentation ? "text-slate-800" : "text-slate-800 dark:text-slate-100")}>
                          {opt}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>

              <AnimatePresence>
                {showResults && answered && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className={cn(
                      "pl-11 text-sm font-medium",
                      correct ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {correct ? "Correct — great work!" : "Not quite — review the module and try again."}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}

        {!readOnly && (
          <div className={cn("flex flex-wrap items-center justify-between gap-3 pt-2 border-t", inPresentation ? "border-slate-200/80" : "border-slate-200/80 dark:border-white/10")}>
            {showResults && submitted ? (
              <p className={cn("text-sm", inPresentation ? "text-slate-600" : "text-slate-600 dark:text-slate-300")}>
                Score: <strong className={inPresentation ? "text-violet-800" : "text-violet-700 dark:text-violet-300"}>{correctCount}</strong> of{" "}
                {questions.length} correct
              </p>
            ) : (
              <p className="text-xs text-slate-500">Answer every question, then submit to continue.</p>
            )}
            <Button
              onClick={() => void handleSubmit()}
              disabled={saving || !allAnswered}
              className={cn("gap-1.5", allAnswered && camperCta)}
            >
              {saving ? "Submitting…" : submitted ? "Answers saved" : "Submit answers"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
