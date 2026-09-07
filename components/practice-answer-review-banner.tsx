"use client"

import { CheckCircle2, XCircle } from "lucide-react"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { cn } from "@/lib/utils"
import {
  isPracticePartialCredit,
  type PracticeAnswerReview,
  type PracticeAnswerReviewOption,
} from "@/lib/practice-answer-review"

type Props = {
  review: PracticeAnswerReview
}

function AnswerChip({
  letter,
  text,
  tone,
}: {
  letter: string
  text: string
  tone: "correct" | "incorrect" | "partial"
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3 py-2.5",
        tone === "correct"
          ? "border-green-200/80 bg-green-50/90 dark:border-green-800/60 dark:bg-green-950/35"
          : tone === "partial"
            ? "border-amber-200/80 bg-amber-50/90 dark:border-amber-800/60 dark:bg-amber-950/35"
            : "border-red-200/80 bg-red-50/90 dark:border-red-900/50 dark:bg-red-950/35",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white",
          tone === "correct"
            ? "bg-green-600 dark:bg-green-500"
            : tone === "partial"
              ? "bg-amber-600 dark:bg-amber-500"
              : "bg-red-500 dark:bg-red-400",
        )}
      >
        {letter}
      </span>
      <div className="min-w-0 pt-0.5 text-sm leading-snug text-[var(--cc-text)]">
        <QuestionTextRenderer text={text} />
      </div>
    </div>
  )
}

function renderChips(
  options: PracticeAnswerReviewOption[],
  tone: "correct" | "incorrect" | "partial",
) {
  return options.map((opt) => (
    <AnswerChip key={`${tone}-${opt.letter}`} letter={opt.letter} text={opt.text} tone={tone} />
  ))
}

export function PracticeAnswerReviewBanner({ review }: Props) {
  const selected = review.options.filter((opt) => opt.isSelected)
  const correct = review.options.filter((opt) => opt.isCorrect)
  const hasOptionRows = review.options.length > 0
  const isPartial = isPracticePartialCredit(review)

  const selectedCorrect = selected.filter((opt) => opt.isCorrect)
  const selectedWrong = selected.filter((opt) => !opt.isCorrect)
  const missedCorrect = correct.filter((opt) => !opt.isSelected)

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        review.isCorrect
          ? "border-green-200/70 bg-white dark:border-green-900/50 dark:bg-green-950/20"
          : isPartial
            ? "border-amber-200/70 bg-white dark:border-amber-900/50 dark:bg-amber-950/20"
            : "border-red-200/70 bg-white dark:border-red-900/40 dark:bg-red-950/15",
      )}
    >
      <div
        className={cn(
          "flex items-start gap-2.5 border-b px-4 py-3",
          review.isCorrect
            ? "border-green-100 bg-green-50/80 dark:border-green-900/40 dark:bg-green-950/30"
            : isPartial
              ? "border-amber-100 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/30"
              : "border-red-100 bg-red-50/80 dark:border-red-900/40 dark:bg-red-950/25",
        )}
      >
        {review.isCorrect ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
        ) : isPartial ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        ) : (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        )}
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-semibold",
              review.isCorrect
                ? "text-green-800 dark:text-green-200"
                : isPartial
                  ? "text-amber-900 dark:text-amber-100"
                  : "text-red-800 dark:text-red-200",
            )}
          >
            {review.isCorrect
              ? "Correct!"
              : isPartial
                ? typeof review.score === "number"
                  ? `Partial credit (${Math.round(review.score)}%)`
                  : "Partial credit"
                : "Incorrect"}
          </p>
          <p
            className={cn(
              "mt-0.5 text-xs",
              review.isCorrect
                ? "text-green-700/90 dark:text-green-300/90"
                : isPartial
                  ? "text-amber-800/90 dark:text-amber-200/90"
                  : "text-red-700/90 dark:text-red-300/90",
            )}
          >
            {review.isCorrect
              ? selected.length > 1
                ? "Your selections match the answer key."
                : "Your answer matches the answer key."
              : isPartial
                ? "Some selections were correct. Review missed options below."
                : "Review the correct answer below."}
          </p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        {hasOptionRows ? (
          review.isCorrect ? (
            <div className="space-y-2">{renderChips(selected.length > 0 ? selected : correct, "correct")}</div>
          ) : isPartial ? (
            <>
              {selectedCorrect.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700/80 dark:text-amber-300/80">
                    Correct selections
                  </p>
                  {renderChips(selectedCorrect, "partial")}
                </div>
              ) : null}
              {selectedWrong.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700/80 dark:text-red-300/80">
                    Incorrect selections
                  </p>
                  {renderChips(selectedWrong, "incorrect")}
                </div>
              ) : null}
              {missedCorrect.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700/80 dark:text-green-300/80">
                    Missed correct answer{missedCorrect.length > 1 ? "s" : ""}
                  </p>
                  {renderChips(missedCorrect, "correct")}
                </div>
              ) : null}
            </>
          ) : (
            <>
              {selected.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700/80 dark:text-red-300/80">
                    Your answer
                  </p>
                  {renderChips(selected, "incorrect")}
                </div>
              ) : null}
              {correct.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700/80 dark:text-green-300/80">
                    Correct answer{correct.length > 1 ? "s" : ""}
                  </p>
                  {renderChips(correct, "correct")}
                </div>
              ) : null}
            </>
          )
        ) : (
          <p className="text-sm text-[var(--cc-text-muted)]">{review.summary}</p>
        )}
      </div>
    </div>
  )
}
