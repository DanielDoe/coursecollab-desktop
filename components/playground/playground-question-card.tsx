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

/** Matches dashboard-v2 module surfaces (playground lobby, breadcrumbs, etc.) */
const surfaceClass =
  "rounded-2xl sm:rounded-3xl border border-slate-200/70 dark:border-white/[0.08] bg-white/75 dark:bg-white/[0.04] backdrop-blur-xl shadow-[0_2px_12px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)]"

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
      <div className="border-b border-slate-200/60 px-4 py-3 dark:border-white/[0.06] sm:px-6 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Question {questionIndex + 1} of {totalQuestions}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isSelectAll ? "Select all that apply" : isTrueFalse ? "True or false" : "Multiple choice"}
            </p>
          </div>

          {showReadyCountdown ? (
            <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100/90 px-3 py-1.5 text-sm font-medium text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
              <Clock className="h-4 w-4 shrink-0" />
              Starting…
            </div>
          ) : (
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 tabular-nums",
                timerUrgent
                  ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                  : "bg-slate-100/90 text-slate-700 dark:bg-white/[0.06] dark:text-slate-200",
              )}
            >
              <Clock className="h-4 w-4 shrink-0 opacity-70" />
              <span className="text-sm font-semibold">{timeLeft}s</span>
            </div>
          )}
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {!showReadyCountdown && canAnswer && !isRevealing && (
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.04]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000 ease-linear",
                  timerUrgent ? "bg-red-500" : "bg-orange-400/70",
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
          className="text-center text-base font-medium leading-relaxed text-balance text-slate-800 dark:text-slate-100 sm:text-lg md:text-xl"
        />

        {/* Ready overlay */}
        <AnimatePresence>
          {showReadyCountdown && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm dark:bg-[#0B1120]/80 sm:rounded-3xl"
            >
              <motion.div
                key={readyCountdown}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <div className="mb-1 text-5xl font-bold tabular-nums text-slate-800 dark:text-white sm:text-6xl">
                  {readyCountdown}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Get ready…</p>
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
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/35 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B1120]",
                  isRevealing && "cursor-default",
                  !isRevealing &&
                    canAnswer &&
                    !isSelected &&
                    "border-slate-200/70 bg-white/60 hover:border-slate-300 hover:bg-slate-50/90 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/[0.12] dark:hover:bg-white/[0.05]",
                  !isRevealing &&
                    isSelected &&
                    "border-orange-500/50 bg-orange-500/[0.06] ring-1 ring-orange-500/20 dark:border-orange-500/40 dark:bg-orange-500/10",
                  isCorrectOption &&
                    "border-emerald-500/50 bg-emerald-500/[0.08] dark:border-emerald-500/40 dark:bg-emerald-500/10",
                  isWrongSelection &&
                    "border-red-500/50 bg-red-500/[0.08] dark:border-red-500/40 dark:bg-red-500/10",
                  isRevealing && !isCorrectOption && !isWrongSelection && "opacity-40",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors",
                    isCorrectOption && "bg-emerald-500 text-white",
                    isWrongSelection && "bg-red-500 text-white",
                    !isRevealing && isSelected && "bg-orange-500 text-white",
                    !isRevealing &&
                      !isSelected &&
                      "bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-slate-300",
                    isRevealing && !isCorrectOption && !isWrongSelection && "bg-slate-100 text-slate-400",
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
                <span className="flex-1 pt-0.5 text-sm leading-snug text-slate-700 dark:text-slate-200 sm:text-[0.9375rem]">
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
              <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-2 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Zap className="h-4 w-4" />
                <span className="text-sm font-semibold">+{earnedPoints} points</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isRevealing && earnedPoints === 0 && (
          <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
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
                  ? "bg-orange-500 text-white shadow-sm hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-500"
                  : isSelectAll && selectedAnswers.length > 0
                    ? "bg-orange-500 text-white shadow-sm hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-500"
                  : "bg-slate-100 text-slate-400 dark:bg-white/[0.06] dark:text-slate-500",
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
