"use client"

import { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { formatEngineeringQuestionText } from "@/lib/engineering-question-text"
import { normalizeAiFeedbackMath, shouldRenderFeedbackAsMarkdown } from "@/lib/math-markdown"
import "katex/dist/katex.min.css"

export function AiFeedbackMarkdown({ text, className = "text-sm" }: { text: string; className?: string }) {
  const processed = useMemo(
    () => normalizeAiFeedbackMath(formatEngineeringQuestionText(text || "")),
    [text],
  )

  if (!processed.trim()) return null

  const hasMarkdown = shouldRenderFeedbackAsMarkdown(text) || shouldRenderFeedbackAsMarkdown(processed)

  if (!hasMarkdown) {
    const lines = processed.split("\n")
    return (
      <div className={`text-slate-700 dark:text-slate-300 leading-relaxed ${className}`}>
        {lines.map((line, index) => (
          <div key={index} className={line.trim() === "" ? "h-3" : ""}>
            {line}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className={`prose prose-slate max-w-none dark:prose-invert prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-li:text-slate-700 dark:prose-li:text-slate-300 prose-headings:text-slate-900 dark:prose-headings:text-slate-100 [&_.katex]:text-current [&_.katex-display]:text-current [&_.katex-display]:overflow-x-auto ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p({ children }) {
            return <div className="mb-2 last:mb-0 leading-relaxed">{children}</div>
          },
          ul({ children }) {
            return <ul className="my-2 list-disc pl-5 space-y-1.5">{children}</ul>
          },
          ol({ children }) {
            return <ol className="my-2 list-decimal pl-5 space-y-1.5">{children}</ol>
          },
          li({ children }) {
            return <li className="leading-relaxed [&>div]:mb-0">{children}</li>
          },
          strong({ children }) {
            return <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}
