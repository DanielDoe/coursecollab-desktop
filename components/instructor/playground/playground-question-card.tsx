"use client"

import { CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { stripHtmlToPlain } from "@/lib/direct-messages/html"

const playgroundChrome = facultyEmbedChrome("playground")

export function PlaygroundQuestionCard({
  questionText,
  questionType,
  topic,
  difficulty,
  selected,
  onToggle,
}: {
  questionText: string
  questionType: string
  topic?: string | null
  difficulty: string
  selected: boolean
  onToggle: () => void
}) {
  const typeLabel = questionType === "mcq" ? "MCQ" : questionType === "true_false" ? "True/False" : questionType

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full rounded-2xl border p-3 text-left transition-colors",
        selected
          ? cn(playgroundChrome.p.border, playgroundChrome.p.softBg)
          : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--cc-accent-soft)]/45",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
            selected
              ? cn(playgroundChrome.p.iconBg, playgroundChrome.p.iconText, "border-transparent")
              : "border-[var(--border)] text-transparent",
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium text-[var(--cc-text)]">
            {stripHtmlToPlain(questionText) || questionText}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {typeLabel}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
              {difficulty}
            </span>
            {topic ? (
              <span className="max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {topic}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  )
}
