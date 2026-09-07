"use client"

import type { FlashcardMcq } from "@/lib/flashcard-quiz"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { CheckCircle2, XCircle } from "lucide-react"

const CHOICE_LETTERS = ["A", "B", "C", "D", "E"] as const

function choiceLetter(index: number): string {
  return CHOICE_LETTERS[index] ?? String(index + 1)
}

type PromptProps = {
  mcq: FlashcardMcq
  badge: string
  variant?: "quiz" | "check"
  focus?: boolean
  className?: string
}

/** Quiz-taker-style stem (no decorative card chrome). */
export function FlashcardMcqPrompt({
  mcq,
  badge,
  focus = false,
  className,
}: PromptProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <p
        className={cn(
          "text-xs font-medium uppercase tracking-wide",
          focus ? "text-white/50" : "text-slate-500 dark:text-slate-400",
        )}
      >
        {badge}
      </p>
      <p className={cn("text-sm", focus ? "text-white/55" : "text-slate-500 dark:text-slate-400")}>
        {mcq.promptLabel}
      </p>
      <div
        className={cn(
          "text-base font-medium leading-relaxed sm:text-lg",
          focus ? "text-white/95" : "text-slate-900 dark:text-slate-100",
        )}
      >
        <QuestionTextRenderer text={mcq.promptText} />
      </div>
    </div>
  )
}

type ChoicesProps = {
  mcq: FlashcardMcq
  focus?: boolean
  locked?: boolean
  feedback?: "correct" | "incorrect" | null
  selectedChoiceId?: string | null
  previewCorrect?: boolean
  onSelect?: (choiceId: string) => void
  className?: string
}

/** MCQ options — matches `QuestionRenderer` mcq branch in quiz-taker. */
export function FlashcardMcqChoices({
  mcq,
  focus = false,
  locked = false,
  feedback = null,
  selectedChoiceId = null,
  previewCorrect = false,
  onSelect,
  className,
}: ChoicesProps) {
  const interactive = Boolean(onSelect) && !previewCorrect

  return (
    <div className={cn("space-y-3", className)}>
      <AnimatePresence mode="wait">
        {feedback ? (
          <motion.div
            key={feedback}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
              feedback === "correct"
                ? "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                : "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200",
            )}
          >
            {feedback === "correct" ? (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Correct!
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 shrink-0" />
                Not quite — review the highlighted answer
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {mcq.choices.map((choice, index) => {
        const letter = choiceLetter(index)
        const isSelected = selectedChoiceId === choice.id
        const showCorrect =
          (previewCorrect && choice.isCorrect) || (feedback != null && choice.isCorrect)
        const isWrongSelection = feedback === "incorrect" && isSelected && !choice.isCorrect

        return (
          <motion.button
            key={choice.id}
            type="button"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.3 }}
            whileHover={!feedback && !locked && interactive ? { scale: 1.02, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" } : {}}
            whileTap={!feedback && !locked && interactive ? { scale: 0.98 } : {}}
            disabled={locked || !interactive || feedback != null}
            onClick={interactive ? () => onSelect?.(choice.id) : undefined}
            className={cn(
              "w-full rounded-lg border-2 p-4 text-left transition-all",
              focus
                ? showCorrect
                  ? "border-green-400 bg-green-500/15"
                  : isWrongSelection
                    ? "border-red-400 bg-red-500/15"
                    : isSelected
                      ? "border-white/40 bg-white/10"
                      : "border-white/15 bg-white/5 hover:border-white/30"
                : showCorrect
                  ? "border-green-500 bg-green-50 dark:border-green-600 dark:bg-green-900/30"
                  : isWrongSelection
                    ? "border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-900/30"
                    : isSelected
                      ? "border-primary bg-primary/5 dark:bg-primary/10"
                      : "border-slate-200 bg-white hover:border-primary/50 dark:border-slate-500 dark:bg-slate-800",
              (locked || feedback != null) && "cursor-not-allowed opacity-60",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-semibold",
                  focus
                    ? showCorrect
                      ? "border-green-400 bg-green-500 text-white"
                      : isWrongSelection
                        ? "border-red-400 bg-red-500 text-white"
                        : isSelected
                          ? "border-white bg-white text-slate-900"
                          : "border-white/30 text-white/80"
                    : showCorrect
                      ? "border-green-500 bg-green-500 text-white"
                      : isWrongSelection
                        ? "border-red-500 bg-red-500 text-white"
                        : isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-slate-300 text-slate-600 dark:border-slate-500 dark:text-slate-300",
                )}
              >
                {showCorrect ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : isWrongSelection ? (
                  <XCircle className="h-5 w-5" />
                ) : (
                  letter
                )}
              </div>
              <div
                className={cn(
                  "min-w-0 flex-1",
                  focus ? "text-white/95" : "text-slate-900 dark:text-slate-100",
                )}
              >
                <QuestionTextRenderer text={choice.text} />
              </div>
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

type PanelProps = {
  mcq: FlashcardMcq
  badge: string
  variant?: "quiz" | "check"
  focus?: boolean
  feedback?: "correct" | "incorrect" | null
  selectedChoiceId?: string | null
  locked?: boolean
  onSelect?: (choiceId: string) => void
  hint?: string
  className?: string
}

/** Quiz-taker layout: stem + lettered MCQ options (no flashcard chrome). */
export function FlashcardMcqPanel({
  mcq,
  badge,
  variant = "quiz",
  focus = false,
  feedback = null,
  selectedChoiceId = null,
  locked = false,
  onSelect,
  hint,
  className,
}: PanelProps) {
  void variant

  return (
    <div className={cn("mx-auto w-full max-w-3xl space-y-4 sm:space-y-5 md:space-y-6", className)}>
      <FlashcardMcqPrompt mcq={mcq} badge={badge} variant={variant} focus={focus} />
      <FlashcardMcqChoices
        mcq={mcq}
        focus={focus}
        feedback={feedback}
        selectedChoiceId={selectedChoiceId}
        locked={locked}
        onSelect={onSelect}
      />
      {hint ? (
        <p className={cn("text-center text-xs", focus ? "text-white/55" : "text-slate-500 dark:text-slate-400")}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
