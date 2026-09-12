"use client"

import type { ReactNode } from "react"
import { CoraErrorAnalysisHeader } from "@/components/cora/CoraErrorAnalysisHeader"
import { FeedbackTextRenderer } from "@/components/question-text-renderer"
import { cn } from "@/lib/utils"

type Props = {
  content: string
  theme?: "light" | "dark"
  /** Use error-analysis tint when the reply is a compiler / suggest-fix result */
  tone?: "error-analysis" | "default"
  className?: string
}

function looksLikeCompilerErrorAnalysis(content: string): boolean {
  const text = content.trim()
  if (!text) return false
  return (
    /compiler error analysis/i.test(text) ||
    /\*\*line\s+\d+:/i.test(text) ||
    /\*\*fix:/i.test(text) ||
    /error identified/i.test(text) ||
    /expected ';'/i.test(text)
  )
}

function parseLineAndFix(content: string): { line?: string; problem?: string; fix?: string } | null {
  const lineMatch = content.match(/\*\*Line\s+(\d+):\*\*\s*([^\n*]+)/i)
  const fixMatch = content.match(/\*\*Fix:\*\*\s*([^\n]+)/i)
  if (!lineMatch && !fixMatch) return null
  return {
    line: lineMatch?.[1],
    problem: lineMatch?.[2]?.trim(),
    fix: fixMatch?.[1]?.trim(),
  }
}

/** Strip AI boilerplate headings so we render our own header + body. */
function stripErrorAnalysisBoilerplate(content: string): string {
  return content
    .trim()
    .replace(/^#{1,2}\s*Compiler Error Analysis\s*\n+/im, "")
    .replace(/^🔴\s*\*?\*?Error Identified\*?\*?\s*\n+/im, "")
    .replace(/^🔴\s*Error Identified\s*\n+/im, "")
    .replace(/^\*?\*?Error Identified\*?\*?\s*\n+/im, "")
    .trim()
}

function extractLineNumber(content: string): string | undefined {
  const fromLabel = content.match(/\*\*Line\s+(\d+):/i)?.[1]
  if (fromLabel) return fromLabel
  const fromText = content.match(/line\s+(\d+)\s*[-—]/i)?.[1]
  return fromText
}

function ErrorAnalysisShell({
  line,
  isLight,
  children,
  className,
}: {
  line?: string
  isLight: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "cora-error-analysis overflow-hidden rounded-xl ring-1",
        isLight ? "bg-white ring-neutral-200" : "bg-[#12161f] ring-white/10",
        className,
      )}
    >
      <CoraErrorAnalysisHeader line={line} theme={isLight ? "light" : "dark"} />
      <div className="px-3.5 py-3">{children}</div>
    </div>
  )
}

export function CoraRichReply({ content, theme = "dark", tone = "default", className }: Props) {
  const isLight = theme === "light"
  const useErrorTone = tone === "error-analysis" || looksLikeCompilerErrorAnalysis(content)
  const parsed = useErrorTone ? parseLineAndFix(content) : null
  const lineHint = parsed?.line ?? extractLineNumber(content)

  const lineLabelClass = isLight ? "font-semibold text-rose-700" : "font-semibold text-rose-300"
  const fixLabelClass = isLight ? "font-semibold text-emerald-700" : "font-semibold text-emerald-300"
  const proseClass = cn(
    "cora-ai-reply text-[14px] leading-[1.6]",
    isLight ? "text-neutral-800" : "text-neutral-100",
    "[&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold",
    isLight ? "[&_strong]:text-neutral-900" : "[&_strong]:text-white",
    isLight
      ? "[&_code]:rounded [&_code]:bg-neutral-900 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-neutral-100"
      : "[&_code]:rounded [&_code]:bg-black/40 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-rose-50",
  )

  if (useErrorTone && parsed?.line && parsed.fix) {
    return (
      <ErrorAnalysisShell line={parsed.line} isLight={isLight} className={className}>
        <p className="mb-2 text-[13px] leading-snug">
          <span className={lineLabelClass}>Line {parsed.line}:</span> {parsed.problem}
        </p>
        <p className="text-[13px] leading-snug">
          <span className={fixLabelClass}>Fix:</span> {parsed.fix}
        </p>
      </ErrorAnalysisShell>
    )
  }

  if (useErrorTone) {
    const body = stripErrorAnalysisBoilerplate(content)
    return (
      <ErrorAnalysisShell line={lineHint} isLight={isLight} className={className}>
        <FeedbackTextRenderer text={body} className={proseClass} />
      </ErrorAnalysisShell>
    )
  }

  return <FeedbackTextRenderer text={content} className={cn(proseClass, className)} />
}
