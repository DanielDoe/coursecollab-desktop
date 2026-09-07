"use client"

import { useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import { formatEngineeringQuestionText, formatLetteredSubparts } from "@/lib/engineering-question-text"
import {
  hasMathContent,
  normalizeAiFeedbackMath,
  normalizeExplanationMarkdown,
  normalizeMathDelimiters,
  repairLatexDamagedByJsonEscapes,
  shouldRenderFeedbackAsMarkdown,
  fixUnbracedMultiCharSubscriptsInMath,
} from "@/lib/math-markdown"
import {
  hasHtmlTags,
  hasMarkdownOutsideHtml,
  prepareHtmlQuestionText,
} from "@/lib/html-question-text"
import "katex/dist/katex.min.css"

interface QuestionTextRendererProps {
  text: string
  className?: string
  questionId?: number
}

/** Readable question copy in light and dark mode (prose-invert alone is unreliable with KaTeX). */
const QUESTION_TEXT_ROOT_CLASS =
  "question-text-content max-w-none text-slate-900 dark:text-slate-100 [&_.katex]:text-current [&_.katex-display]:text-current " +
  "[&_.katex:not(.katex-display)]:inline-block [&_.katex:not(.katex-display)]:mx-[0.42em] [&_.katex:not(.katex-display)]:px-[0.08em] [&_.katex:not(.katex-display)]:align-[-0.08em]"

/** Step-by-step solution layout for sample practice / worked examples. */
const EXPLANATION_ROOT_CLASS =
  "sample-practice-explanation max-w-none text-slate-800 dark:text-slate-200 " +
  "[&_.katex]:text-current [&_.katex-display]:text-current " +
  "[&_.katex-display]:my-1.5 [&_.katex-display]:overflow-x-auto [&_.katex-display]:text-[0.95rem] " +
  "[&_.katex-display]:!text-left [&_.katex-display>.katex]:!text-left"

function parseCodeBlocks(input: string): string {
  let parsed = input.replace(/\\n/g, "\n")
  const languageTagMatch = parsed.match(/^(cpp|c|python|java|javascript|typescript)\n/)
  if (languageTagMatch) {
    const language = languageTagMatch[1]
    const codeContent = parsed.substring(languageTagMatch[0].length)
    parsed = `\`\`\`${language}\n${codeContent}\n\`\`\``
  }
  return parsed
}

function useThemeIsDark() {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  )
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"))
    const handler = () => setIsDark(document.documentElement.classList.contains("dark"))
    window.addEventListener("theme-change", handler)
    return () => window.removeEventListener("theme-change", handler)
  }, [])
  return isDark
}

function MarkdownMathBody({
  processedText,
  className,
  isDark,
}: {
  processedText: string
  className: string
  isDark: boolean
}) {
  const codeBlockStyle = isDark ? vscDarkPlus : oneLight
  return (
    <div className={`prose prose-slate dark:prose-invert ${QUESTION_TEXT_ROOT_CLASS} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "")
            const language = match ? match[1] : "cpp"

            return !inline ? (
              <div
                className="my-4 max-w-full overflow-x-auto rounded-lg [&>pre]:!m-0 [&>pre]:!rounded-lg [&>pre]:!p-4 [&>pre]:!text-sm"
                style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}
              >
                <SyntaxHighlighter
                  language={language}
                  style={codeBlockStyle}
                  customStyle={{
                    margin: 0,
                    padding: "1rem",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    background: isDark ? "#1e293b" : "#f8fafc",
                  }}
                  codeTagProps={{ style: { fontFamily: "ui-monospace, monospace" } }}
                  showLineNumbers={false}
                  PreTag="pre"
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code
                className={`inline-code px-1.5 py-0.5 rounded text-sm font-mono ${isDark ? "bg-slate-700/80 text-slate-200 border border-slate-600" : "bg-slate-200 text-slate-900 border border-slate-300"}`}
                {...props}
              >
                {children}
              </code>
            )
          },
          pre({ children }) {
            return <div>{children}</div>
          },
          p({ children }) {
            return (
              <div className="mb-3 last:mb-0 leading-relaxed text-slate-900 dark:text-slate-100">
                {children}
              </div>
            )
          },
          ul({ children }) {
            return <ul className="my-3 list-disc pl-5 space-y-1.5 last:mb-0">{children}</ul>
          },
          ol({ children }) {
            return <ol className="my-3 list-decimal pl-5 space-y-1.5 last:mb-0">{children}</ol>
          },
          li({ children }) {
            return (
              <li className="leading-relaxed text-slate-900 dark:text-slate-100 [&>div]:mb-0">
                {children}
              </li>
            )
          },
          strong({ children }) {
            return <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>
          },
          br() {
            return <br />
          },
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  )
}

function RichTextContent({
  text,
  className,
  processedText,
  forceMarkdown,
}: {
  text: string
  className: string
  processedText: string
  forceMarkdown?: boolean
}) {
  const isDark = useThemeIsDark()
  const hasMath = hasMathContent(text) || hasMathContent(processedText)
  const hasCodeFence = processedText.includes("```") || processedText.includes("~~~")
  const hasHTML = hasHtmlTags(processedText)
  const hasMarkdown = hasMarkdownOutsideHtml(processedText)

  if (hasHTML && !forceMarkdown) {
    return (
      <div
        className={`prose prose-slate dark:prose-invert ${QUESTION_TEXT_ROOT_CLASS} ${className}`}
        dangerouslySetInnerHTML={{ __html: prepareHtmlQuestionText(processedText) }}
      />
    )
  }

  if (!forceMarkdown && !hasMarkdown && !hasMath) {
    const lines = processedText.split("\n")
    return (
      <div className={`${QUESTION_TEXT_ROOT_CLASS} leading-relaxed ${className}`}>
        {lines.map((line, index) => (
          <div key={index} className={line.trim() === "" ? "h-4" : ""}>
            {line}
          </div>
        ))}
      </div>
    )
  }

  return <MarkdownMathBody processedText={processedText} className={className} isDark={isDark} />
}

function ExplanationMarkdownBody({
  processedText,
  className,
}: {
  processedText: string
  className: string
}) {
  return (
    <div className={`${EXPLANATION_ROOT_CLASS} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h3({ children }) {
            return (
              <h3 className="mt-4 first:mt-0 mb-2 border-b border-slate-200/80 pb-1 text-sm font-semibold text-slate-900 dark:border-white/10 dark:text-white">
                {children}
              </h3>
            )
          },
          p({ children }) {
            return (
              <p className="mb-2 last:mb-0 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {children}
              </p>
            )
          },
          ul({ children }) {
            return <ul className="my-2 list-disc space-y-1 pl-5 text-sm">{children}</ul>
          },
          ol({ children }) {
            return <ol className="my-2 list-decimal space-y-1 pl-5 text-sm">{children}</ol>
          },
          li({ children }) {
            return <li className="leading-relaxed text-slate-700 dark:text-slate-300">{children}</li>
          },
          strong({ children }) {
            return <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>
          },
        }}
      >
        {processedText}
      </ReactMarkdown>
    </div>
  )
}

export function QuestionTextRenderer({
  text,
  className = "",
  questionId,
}: QuestionTextRendererProps) {
  const processedText = fixUnbracedMultiCharSubscriptsInMath(
    normalizeMathDelimiters(
      repairLatexDamagedByJsonEscapes(
        formatLetteredSubparts(formatEngineeringQuestionText(parseCodeBlocks(text))),
      ),
    ),
  )
  return <RichTextContent text={text} className={className} processedText={processedText} />
}

/** Renders worked sample-practice solutions with section headings and readable math layout. */
export function ExplanationTextRenderer({ text, className = "" }: { text: string; className?: string }) {
  const processedText = normalizeExplanationMarkdown(text)
  if (!processedText.trim()) return null
  return <ExplanationMarkdownBody processedText={processedText} className={className} />
}

/** Renders AI / instructor feedback with LaTeX + markdown (handles bare $$ and v_L=... expressions). */
export function FeedbackTextRenderer({ text, className = "" }: { text: string; className?: string }) {
  const processedText = normalizeAiFeedbackMath(text)
  const useMarkdown = shouldRenderFeedbackAsMarkdown(text)
  return (
    <RichTextContent
      text={text}
      className={className}
      processedText={processedText}
      forceMarkdown={useMarkdown}
    />
  )
}
