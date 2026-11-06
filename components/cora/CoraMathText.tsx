"use client"

import { FeedbackTextRenderer } from "@/components/question-text-renderer"
import { cn } from "@/lib/utils"

type Props = {
  text: string
  className?: string
  /** Render a bare formula as display math. */
  display?: boolean
  /** Drop the paragraph gap under a one-line label or choice. */
  compact?: boolean
  align?: "left" | "center"
}

function asDisplayMath(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return text
  if (/\$|\\\(|\\\[/.test(trimmed)) return text
  return `$$\n${trimmed}\n$$`
}

/** Typeset Cora chat copy, including bare LaTeX on walkthrough equations and choices. */
export function CoraMathText({ text, className, display = false, compact = false, align = "left" }: Props) {
  return (
    <FeedbackTextRenderer
      text={display ? asDisplayMath(text) : text}
      className={cn(
        "cora-ai-reply text-current [&_.katex]:text-current [&_.katex-display]:overflow-x-auto [&_.katex-display]:text-left [&_.katex-display>.katex]:text-left",
        align === "center" && "cora-math-center",
        compact && "[&>div]:!mb-0",
        className,
      )}
    />
  )
}
