"use client"

import { BookOpen, X } from "lucide-react"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { QuestionMediaDisplay } from "@/components/question-media-display"
import { mediaSourcesFromProblem } from "@/lib/cora/attach-question-media"
import type { CoraProblemContext } from "@/lib/cora/types"
import { cn } from "@/lib/utils"

type Props = {
  label?: string | null
  problem: CoraProblemContext
  compact?: boolean
  onClear?: () => void
  className?: string
}

export function CoraImportedQuestionPreview({
  label,
  problem,
  compact = false,
  onClear,
  className,
}: Props) {
  const title = label?.trim() || problem.title?.trim() || "Imported question"
  const mediaQuestion = mediaSourcesFromProblem(problem)

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-violet-200/80 bg-violet-50/80 dark:border-violet-500/25 dark:bg-violet-500/10",
        className,
      )}
    >
      <div className="flex items-start gap-2 border-b border-violet-200/60 px-3 py-2 dark:border-violet-500/20">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-violet-900 dark:text-violet-100">{title}</p>
          <p className="text-[10px] uppercase tracking-wide text-violet-600/80 dark:text-violet-300/70">
            Confirm question & diagram before sending
          </p>
        </div>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full p-1 text-violet-600 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-500/20"
            aria-label="Remove imported question"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className={cn("space-y-3 px-3 py-3", compact ? "max-h-[280px] overflow-y-auto" : "max-h-[360px] overflow-y-auto")}>
        <QuestionMediaDisplay
          question={mediaQuestion}
          size={compact ? "compact" : "medium"}
          className="mx-auto"
        />
        <QuestionTextRenderer
          text={problem.questionText}
          className={cn("text-sm", compact && "text-[13px]")}
        />
      </div>
    </div>
  )
}
