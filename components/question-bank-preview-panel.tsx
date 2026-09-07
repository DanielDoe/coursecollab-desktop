"use client"

import { Badge } from "@/components/ui/badge"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { formatEngineeringQuestionText } from "@/lib/engineering-question-text"
import { QuestionMediaDisplay } from "@/components/question-media-display"
import { cn } from "@/lib/utils"
import {
  formatQuestionTypeLabel,
  isBankOptionCorrect,
  normalizeBankOptions,
  optionLetter,
} from "@/lib/question-bank-preview"
import { CheckCircle2 } from "lucide-react"
import { parseSubquestions, subquestionOptionLabels } from "@/lib/multi-part-question"
import { subquestionAllowsSolutionUpload, subquestionBonusPercent } from "@/lib/solution-upload"
import { Paperclip } from "lucide-react"

export type QuestionBankPreviewData = {
  id?: number
  question_text: string
  question_type: string
  difficulty?: string | null
  topic?: string | null
  hint?: string | null
  explanation?: string | null
  sample_answer?: string | null
  evaluation_mode?: string | null
  options?: unknown
  correct_answer?: unknown
  question_media?: unknown
  circuit_spec?: unknown
  subquestions?: unknown
}

export function QuestionBankPreviewPanel({ question }: { question: QuestionBankPreviewData }) {
  const options = normalizeBankOptions(question.options)
  const type = (question.question_type || "mcq").toLowerCase()
  const isMultiPart = type === "multi_part"
  const subquestions = isMultiPart ? parseSubquestions(question.subquestions) : []
  const showOptions = !isMultiPart && options.length > 0 && ["mcq", "true_false", "select_all"].includes(type)
  const isSelectAll = type === "select_all"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {question.id != null ? (
          <Badge variant="outline" className="text-xs font-mono">
            ID {question.id}
          </Badge>
        ) : null}
        <Badge variant="secondary" className="text-xs">
          {formatQuestionTypeLabel(question.question_type)}
        </Badge>
        {question.difficulty ? (
          <Badge
            variant="outline"
            className={cn(
              "text-xs capitalize",
              question.difficulty === "easy" && "border-emerald-300 text-emerald-700 dark:text-emerald-300",
              question.difficulty === "medium" && "border-amber-300 text-amber-800 dark:text-amber-300",
              question.difficulty === "hard" && "border-red-300 text-red-700 dark:text-red-300",
            )}
          >
            {question.difficulty}
          </Badge>
        ) : null}
        {question.topic ? (
          <Badge variant="outline" className="text-xs max-w-full truncate">
            {question.topic}
          </Badge>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-slate-600 bg-white dark:bg-slate-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200/70 dark:border-slate-600 bg-slate-50/90 dark:bg-slate-800/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Question stem
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <QuestionMediaDisplay question={question} className="mb-4" />
          <QuestionTextRenderer
            text={question.question_text}
            className="text-sm sm:text-base leading-relaxed text-slate-800 dark:text-slate-100 prose prose-sm dark:prose-invert max-w-none"
          />
        </div>
      </div>

      {isMultiPart && subquestions.length > 0 ? (
        <div className="space-y-4">
          {subquestions.map((sq) => {
            const labels = subquestionOptionLabels(sq)
            const isSqSelectAll = sq.type === "select_all"
            return (
              <div
                key={sq.id}
                className="rounded-xl border border-slate-200/80 dark:border-slate-600 overflow-hidden"
              >
                <div className="px-4 py-2.5 border-b border-slate-200/70 dark:border-slate-600 bg-slate-50/90 dark:bg-slate-800/50">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Part {sq.id}
                    {sq.points ? ` · ${sq.points} pt` : ""}
                  </p>
                  <p className="text-sm text-slate-800 dark:text-slate-100 mt-1">{sq.prompt}</p>
                  {subquestionAllowsSolutionUpload(sq) ? (
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />
                      Solution upload (+{subquestionBonusPercent(sq)}% bonus)
                    </p>
                  ) : null}
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/80">
                  {labels.map(({ letter, text }) => {
                    const correct = isSqSelectAll
                      ? (sq.correct_answers ?? []).map((x) => x.toUpperCase()).includes(letter.toUpperCase())
                      : sq.correct_answer?.toUpperCase() === letter.toUpperCase()
                    return (
                      <li
                        key={letter}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 text-sm",
                          correct
                            ? "bg-emerald-50/90 dark:bg-emerald-950/30"
                            : "bg-white dark:bg-slate-900/20",
                        )}
                      >
                        <span
                          className={cn(
                            "shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold border",
                            correct
                              ? "border-emerald-400 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                              : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300",
                          )}
                        >
                          {letter}
                        </span>
                        <span className="flex-1 min-w-0 pt-0.5 text-slate-800 dark:text-slate-100">{text}</span>
                        {correct ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      ) : null}

      {showOptions ? (
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-600 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200/70 dark:border-slate-600 bg-slate-50/90 dark:bg-slate-800/50 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {isSelectAll ? "Answer choices (multiple correct)" : "Answer choices"}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Correct marked in green</p>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/80">
            {options.map((opt, i) => {
              const correct = isBankOptionCorrect(i, question.correct_answer, options)
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 text-sm",
                    correct
                      ? "bg-emerald-50/90 dark:bg-emerald-950/30"
                      : "bg-white dark:bg-slate-900/20",
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold border",
                      correct
                        ? "border-emerald-400 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                        : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300",
                    )}
                  >
                    {optionLetter(i)}
                  </span>
                  <span className="flex-1 min-w-0 pt-0.5 text-slate-800 dark:text-slate-100 break-words">
                    {formatEngineeringQuestionText(opt)}
                  </span>
                  {correct ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {question.hint ? (
        <div className="rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/25 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200 mb-1">
            Hint
          </p>
          <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap">{question.hint}</p>
        </div>
      ) : null}

      {question.explanation ? (
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Explanation
          </p>
          <QuestionTextRenderer
            text={question.explanation}
            className="text-sm text-slate-700 dark:text-slate-200 prose prose-sm dark:prose-invert max-w-none"
          />
        </div>
      ) : null}

      {question.sample_answer && !showOptions ? (
        <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200 mb-1">
            Sample / canonical answer
          </p>
          <QuestionTextRenderer
            text={String(question.sample_answer)}
            className="text-sm text-slate-800 dark:text-slate-100 prose prose-sm dark:prose-invert max-w-none"
          />
        </div>
      ) : null}
    </div>
  )
}
