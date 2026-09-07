"use client"

import ReactMarkdown from "react-markdown"
import { highlightMatch } from "@/lib/syllabus/highlight-text"
import { useSyllabusAccent } from "@/lib/syllabus/syllabus-accent"
import { cn } from "@/lib/utils"
import { SYLLABUS_MARKDOWN_ROOT } from "@/lib/syllabus/syllabus-surface-classes"

type SyllabusMarkdownProps = {
  content: string
  className?: string
  highlight?: string
  variant?: "default" | "compact" | "callout"
}

function wrapText(children: React.ReactNode, highlight?: string): React.ReactNode {
  if (typeof children === "string") return highlightMatch(children, highlight)
  if (Array.isArray(children)) {
    return children.map((child, i) =>
      typeof child === "string" ? <span key={i}>{highlightMatch(child, highlight)}</span> : child,
    )
  }
  return children
}

export function SyllabusMarkdown({
  content,
  className,
  highlight,
  variant = "default",
}: SyllabusMarkdownProps) {
  const accent = useSyllabusAccent()
  if (!content?.trim()) return null

  return (
    <div
      className={cn(
        SYLLABUS_MARKDOWN_ROOT,
        variant === "default" && [
          "[&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:border-b [&_h2]:border-[var(--border)]/60 [&_h2]:pb-2 [&_h2]:text-lg [&_h2]:font-semibold",
          "[&_h2]:text-[var(--cc-text)]",
          "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[var(--cc-text)]",
        ],
        variant === "compact" && ["[&_p]:my-2 [&_p]:text-sm", "[&_li]:text-sm"],
        variant === "callout" && [
          cn("rounded-xl p-4 ring-1 ring-[var(--border)]/50", accent.calloutBg, accent.calloutBorder),
          "[&_p]:text-sm [&_p]:text-[var(--cc-text)]",
        ],
        className,
      )}
    >
      <ReactMarkdown
        components={{
          p: ({ children }) => <p>{wrapText(children, highlight)}</p>,
          li: ({ children }) => <li>{wrapText(children, highlight)}</li>,
          strong: ({ children }) => <strong>{wrapText(children, highlight)}</strong>,
          h2: ({ children }) => (
            <h2 className="flex items-center gap-2">
              <span className={cn("h-4 w-1 shrink-0 rounded-full bg-[var(--cc-accent)]")} aria-hidden />
              {wrapText(children, highlight)}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="rounded-lg bg-[var(--cc-accent-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--cc-text)]">
              {wrapText(children, highlight)}
            </h3>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {wrapText(children, highlight)}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
