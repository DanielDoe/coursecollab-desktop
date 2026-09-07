"use client"

import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneLight, vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { cn } from "@/lib/utils"

type LectureAiMarkdownProps = {
  content: string
  className?: string
}

/** Normalize common AI markdown quirks before rendering. */
function normalizeAiMarkdown(content: string): string {
  return content
    .replace(/\*\*([^*]+)\*\*\s+:/g, "**$1**:")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Renders AI assistant replies with readable markdown (headings, lists, code, emphasis). */
export function LectureAiMarkdown({ content, className }: LectureAiMarkdownProps) {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  )

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"))
    const handler = () => setIsDark(document.documentElement.classList.contains("dark"))
    window.addEventListener("theme-change", handler)
    return () => window.removeEventListener("theme-change", handler)
  }, [])

  const processed = normalizeAiMarkdown(content)
  const codeBlockStyle = isDark ? vscDarkPlus : oneLight

  return (
    <div
      className={cn(
        "lecture-ai-markdown min-w-0 max-w-full text-sm leading-relaxed [overflow-wrap:anywhere] [word-break:break-word]",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p({ children }) {
            return (
              <div className="mb-2.5 last:mb-0 text-[var(--cc-text)]">{children}</div>
            )
          },
          h1({ children }) {
            return (
              <h3 className="mb-2 mt-4 first:mt-0 text-base font-bold text-[var(--cc-text)]">
                {children}
              </h3>
            )
          },
          h2({ children }) {
            return (
              <h4 className="mb-2 mt-4 first:mt-0 border-b border-[var(--cc-accent)]/20 pb-1 text-[13px] font-bold tracking-wide text-[var(--cc-accent)]">
                {children}
              </h4>
            )
          },
          h3({ children }) {
            return (
              <h5 className="mb-1.5 mt-3 first:mt-0 text-sm font-semibold text-[var(--cc-text)]">
                {children}
              </h5>
            )
          },
          ul({ children }) {
            return (
              <ul className="mb-2.5 ml-5 list-outside list-disc space-y-1.5 text-[var(--cc-text)] [&_ul]:mb-0 [&_ul]:mt-1.5 [&_ul]:list-[circle] [&_ul_ul]:list-[square]">
                {children}
              </ul>
            )
          },
          ol({ children }) {
            return (
              <ol className="mb-2.5 ml-5 list-outside list-decimal space-y-1.5 text-[var(--cc-text)] [&_ol]:mb-0 [&_ol]:mt-1.5">
                {children}
              </ol>
            )
          },
          li({ children }) {
            return (
              <li className="leading-relaxed [&>div]:!mb-0 [&>ol]:mb-0 [&>ol]:mt-1.5 [&>p]:!mb-0 [&>ul]:mb-0 [&>ul]:mt-1.5">
                {children}
              </li>
            )
          },
          strong({ children }) {
            return (
              <strong className="font-semibold text-[var(--cc-text)]">{children}</strong>
            )
          },
          em({ children }) {
            return <em className="italic text-[var(--cc-text-muted)]">{children}</em>
          },
          code({ children, className: codeClass }) {
            const match = /language-(\w+)/.exec(codeClass || "")
            const language = match ? match[1] : "text"
            const isBlock = Boolean(match)

            if (isBlock) {
              return (
                <div className="my-2.5 -mx-0.5 max-w-full overflow-x-auto rounded-lg [&>pre]:!m-0 [&>pre]:!rounded-lg">
                  <SyntaxHighlighter
                    language={language}
                    style={codeBlockStyle}
                    customStyle={{
                      margin: 0,
                      padding: "0.625rem 0.75rem",
                      borderRadius: "0.5rem",
                      fontSize: "0.75rem",
                      background: isDark ? "#1e293b" : "#f8fafc",
                    }}
                    codeTagProps={{ style: { fontFamily: "ui-monospace, monospace" } }}
                    showLineNumbers={false}
                    PreTag="pre"
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                </div>
              )
            }

            return (
              <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--cc-text)]">
                {children}
              </code>
            )
          },
          pre({ children }) {
            return <div className="[&_pre]:!m-0 [&_pre]:!p-0">{children}</div>
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-2.5 border-l-4 border-[var(--cc-accent)]/50 bg-[var(--cc-accent)]/5 py-1.5 pl-3 text-[var(--cc-text)]">
                {children}
              </blockquote>
            )
          },
          hr() {
            return <hr className="my-3 border-[var(--border)]" />
          },
          table({ children }) {
            return (
              <div className="my-2.5 overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="min-w-full text-left text-xs">{children}</table>
              </div>
            )
          },
          thead({ children }) {
            return <thead className="bg-[var(--muted)]">{children}</thead>
          },
          th({ children }) {
            return (
              <th className="border-b border-[var(--border)] px-3 py-2 font-semibold">
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td className="border-b border-[var(--border)] px-3 py-2">{children}</td>
            )
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}
