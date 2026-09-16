"use client"

import { useState } from "react"
import { BookOpen, ChevronDown, X } from "lucide-react"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { QuestionMediaDisplay } from "@/components/question-media-display"
import { mediaSourcesFromProblem } from "@/lib/cora/attach-question-media"
import type { CoraProblemContext } from "@/lib/cora/types"
import { cn } from "@/lib/utils"

type Props = {
  label?: string | null
  problem: CoraProblemContext
  compact?: boolean
  /** Match quiz / assessment surfaces instead of violet marketing card. */
  variant?: "violet" | "theme"
  /** Collapsed header only until expanded (assessment drawer). */
  collapsible?: boolean
  defaultCollapsed?: boolean
  onClear?: () => void
  className?: string
}

export function CoraImportedQuestionPreview({
  label,
  problem,
  compact = false,
  variant = "violet",
  collapsible = false,
  defaultCollapsed = false,
  onClear,
  className,
}: Props) {
  const [expanded, setExpanded] = useState(!defaultCollapsed)
  const title = label?.trim() || problem.title?.trim() || "Imported question"
  const mediaQuestion = mediaSourcesFromProblem(problem)
  const isTheme = variant === "theme"
  const showBody = !collapsible || expanded

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border",
        isTheme
          ? "border-[var(--border)] bg-[var(--card)]"
          : "border-violet-200/80 bg-violet-50/80 dark:border-violet-500/25 dark:bg-violet-500/10",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-start gap-2 px-3 py-2",
          showBody && "border-b",
          isTheme ? "border-[var(--border)]" : "border-violet-200/60 dark:border-violet-500/20",
        )}
      >
        <BookOpen
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            isTheme ? "text-[var(--cc-accent-dark)]" : "text-violet-600 dark:text-violet-300",
          )}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs font-semibold",
              isTheme ? "text-[var(--cc-text)]" : "text-violet-900 dark:text-violet-100",
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              "text-[10px] uppercase tracking-wide",
              isTheme ? "text-[var(--cc-text-muted)]" : "text-violet-600/80 dark:text-violet-300/70",
            )}
          >
            {collapsible && !expanded
              ? "Tap to review question & diagram"
              : "Confirm question & diagram before sending"}
          </p>
        </div>
        {collapsible ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-full p-1 text-[var(--cc-text-muted)] hover:bg-[var(--muted)]"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse question preview" : "Expand question preview"}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </button>
        ) : null}
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className={cn(
              "rounded-full p-1",
              isTheme
                ? "text-[var(--cc-text-muted)] hover:bg-[var(--muted)]"
                : "text-violet-600 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-500/20",
            )}
            aria-label="Remove imported question"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {showBody ? (
        <div
          className={cn(
            "space-y-3 px-3 py-3",
            compact ? "max-h-[min(28vh,220px)] overflow-y-auto" : "max-h-[360px] overflow-y-auto",
          )}
        >
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
      ) : null}
    </div>
  )
}
