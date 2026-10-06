"use client"

import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, XCircle, Zap, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { formatEngineeringQuestionText } from "@/lib/engineering-question-text"
import {
  getPlaygroundCorrectOptionLetter,
  isPlaygroundSelectAll,
  isPlaygroundTrueFalse,
  normalizePlaygroundCorrectAnswer,
  parsePlaygroundCorrectLetters,
} from "@/lib/playground-question-utils"
import { cn } from "@/lib/utils"

export interface PlaygroundQuestionData {
  id: number
  questionText: string
  questionType: string
  options: string[]
  correctAnswer: unknown
}

interface PlaygroundQuestionCardProps {
  question: PlaygroundQuestionData | null | undefined
  questionIndex: number
  totalQuestions: number
  selectedAnswer: string | null
  selectedAnswers?: string[]
  onSelectAnswer: (letter: string) => void
  onSubmit: () => void
  isRevealing: boolean
  revealedCorrectAnswer: string | null
  earnedPoints: number
  canAnswer: boolean
  showReadyCountdown: boolean
  readyCountdown: number
  timeLeft: number
  durationSec: number
}

const surfaceClass =
  "rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)] shadow-sm sm:rounded-3xl"

export function PlaygroundQuestionCard({
  question,
  questionIndex,
  totalQuestions,
  selectedAnswer,
  selectedAnswers = [],
  onSelectAnswer,
  onSubmit,
  isRevealing,
  revealedCorrectAnswer,
  earnedPoints,
  canAnswer,
  showReadyCountdown,
  readyCountdown,
  timeLeft,
  durationSec,
}: PlaygroundQuestionCardProps) {
  if (!question?.options?.length) {
    return null
  }

  const isTrueFalse = isPlaygroundTrueFalse(question.questionType)
  const isSelectAll = isPlaygroundSelectAll(question.questionType)
  const revealedAnswerText = normalizePlaygroundCorrectAnswer(revealedCorrectAnswer)
  const correctLetters = isSelectAll
    ? parsePlaygroundCorrectLetters(revealedCorrectAnswer ?? question.correctAnswer)
    : []
  const correctLetter =
    isSelectAll
      ? null
      : isRevealing && revealedAnswerText
        ? /^[A-E]$/i.test(revealedAnswerText)
          ? revealedAnswerText.toUpperCase()
          : getPlaygroundCorrectOptionLetter({
              ...question,
              correctAnswer: revealedCorrectAnswer,
            })
        : getPlaygroundCorrectOptionLetter(question)

  const timerUrgent = timeLeft <= 5 && canAnswer && !showReadyCountdown
  const progressPct = totalQuestions > 0 ? ((questionIndex + 1) / totalQuestions) * 100 : 0
  const timerPct =
    durationSec > 0 ? Math.max(0, Math.min(100, (timeLeft / durationSec) * 100)) : 0

  return (
    <section className={cn("relative overflow-hidden", surfaceClass)}>
      {/* Toolbar */}
      <div className="border-b border-[var(--border)] px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-[var(--cc-text)]">
              Question {questionIndex + 1} of {totalQuestions}
            </p>
            <p className="text-xs text-[var(--cc-text-muted)]">
              {isSelectAll ? "Select all that apply" : isTrueFalse ? "True or false" : "Multiple choice"}
            </p>
          </div>

          {showReadyCountdown ? (
            <div className="inline-flex items-center gap-2 rounded-2xl bg-[var(--muted)] px-3 py-1.5 text-sm font-medium text-[var(--cc-text-secondary)]">
              <Clock className="h-4 w-4 shrink-0" />
              Starting…
            </div>
          ) : (
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 tabular-nums",
                timerUrgent
                  ? "bg-[var(--cc-sem-danger-soft)] text-[var(--cc-sem-danger-text)]"
                  : "bg-[var(--muted)] text-[var(--cc-text)]",
              )}
            >
              <Clock className="h-4 w-4 shrink-0 opacity-70" />
              <span className="text-sm font-semibold">{timeLeft}s</span>
            </div>
          )}
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className="h-full rounded-full bg-[var(--cc-accent)] transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {!showReadyCountdown && canAnswer && !isRevealing && (
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000 ease-linear",
                  timerUrgent ? "bg-[var(--cc-sem-danger)]" : "bg-[var(--cc-accent)]",
                )}
                style={{ width: `${timerPct}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
        <QuestionTextRenderer
          text={question.questionText}
          questionId={question.id}
          className="text-center text-base font-medium leading-relaxed text-balance text-[var(--cc-text)] sm:text-lg md:text-xl"
        />

        {/* Ready overlay */}
        <AnimatePresence>
          {showReadyCountdown && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--cc-background)_88%,transparent)] sm:rounded-3xl"
            >
              <motion.div
                key={readyCountdown}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <div className="mb-1 text-5xl font-bold tabular-nums text-[var(--cc-accent)] sm:text-6xl">
                  {readyCountdown}
                </div>
                <p className="text-sm text-[var(--cc-text-muted)]">Get ready…</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Options */}
        <div
          className={cn(
            "mt-8 grid gap-2.5 sm:mt-10 sm:gap-3",
            isTrueFalse ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 md:grid-cols-2",
          )}
        >
          {question.options.map((option, index) => {
            const optionLetter = String.fromCharCode(65 + index)
            const isSelected = isSelectAll
              ? selectedAnswers.includes(optionLetter)
              : selectedAnswer === optionLetter
            const isCorrectOption = isRevealing && (
              isSelectAll
                ? correctLetters.includes(optionLetter)
                : correctLetter === optionLetter
            )
            const isWrongSelection = isRevealing && isSelected && !isCorrectOption
            const displayOption = formatEngineeringQuestionText(option)

            return (
              <motion.button
                key={`${question.id}-${index}`}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => onSelectAnswer(optionLetter)}
                disabled={isRevealing || !canAnswer}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]/35",
                  isRevealing && "cursor-default",
                  !isRevealing &&
                    canAnswer &&
                    !isSelected &&
                    "border-[var(--border)] bg-[var(--cc-background)] hover:bg-[var(--muted)]",
                  !isRevealing &&
                    isSelected &&
                    "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)] ring-1 ring-[var(--cc-accent)]/25",
                  isCorrectOption &&
                    "border-[var(--cc-sem-success-border)] bg-[var(--cc-sem-success-soft)]",
                  isWrongSelection &&
                    "border-[var(--cc-sem-danger-border)] bg-[var(--cc-sem-danger-soft)]",
                  isRevealing && !isCorrectOption && !isWrongSelection && "opacity-40",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors",
                    isCorrectOption && "bg-[var(--cc-sem-success)] text-white",
                    isWrongSelection && "bg-[var(--cc-sem-danger)] text-white",
                    !isRevealing && isSelected && "bg-[var(--cc-accent)] text-white",
                    !isRevealing &&
                      !isSelected &&
                      "bg-[var(--muted)] text-[var(--cc-text-secondary)]",
                    isRevealing && !isCorrectOption && !isWrongSelection && "bg-[var(--muted)] text-[var(--cc-text-muted)]",
                  )}
                >
                  {isCorrectOption ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isWrongSelection ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    optionLetter
                  )}
                </span>
                <span className="flex-1 pt-0.5 text-sm leading-snug text-[var(--cc-text)] sm:text-[0.9375rem]">
                  {displayOption}
                </span>
              </motion.button>
            )
          })}
        </div>

        {/* Feedback */}
        <AnimatePresence>
          {isRevealing && earnedPoints > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 flex justify-center"
            >
              <div className="inline-flex items-center gap-2 rounded-2xl bg-[var(--cc-sem-success-soft)] px-4 py-2 text-[var(--cc-sem-success-text)]">
                <Zap className="h-4 w-4" />
                <span className="text-sm font-semibold">+{earnedPoints} points</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isRevealing && earnedPoints === 0 && (
          <p className="mt-5 text-center text-sm text-[var(--cc-text-muted)]">
            No points this round — keep going!
          </p>
        )}

        {!isRevealing && canAnswer && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 sm:mt-8"
          >
            <Button
              onClick={onSubmit}
              disabled={isSelectAll ? selectedAnswers.length === 0 : !selectedAnswer}
              size="lg"
              className={cn(
                "h-11 w-full rounded-2xl text-sm font-semibold sm:h-12 sm:text-base",
                selectedAnswer
                  ? "bg-[var(--cc-accent)] text-white shadow-sm hover:bg-[var(--cc-accent-hover)]"
                  : isSelectAll && selectedAnswers.length > 0
                    ? "bg-[var(--cc-accent)] text-white shadow-sm hover:bg-[var(--cc-accent-hover)]"
                  : "bg-[var(--muted)] text-[var(--cc-text-muted)]",
              )}
            >
              Submit answer
            </Button>
          </motion.div>
        )}
      </div>
    </section>
  )
}
