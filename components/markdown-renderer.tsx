"use client"

import { sanitizeUserHtml } from "@/lib/security/sanitize-html"
import { useState, useEffect } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const [processedContent, setProcessedContent] = useState("")

  useEffect(() => {
    // Process the content to handle C++ code blocks and other formatting
    let processed = content

    // Convert ```cpp code blocks to proper syntax highlighting
    processed = processed.replace(/```cpp\n([\s\S]*?)\n```/g, (match, code) => {
      return `<pre class="cpp-code-block"><code class="language-cpp">${code}</code></pre>`
    })

    // Convert ``` code blocks (generic) to proper formatting
    processed = processed.replace(/```\n([\s\S]*?)\n```/g, (match, code) => {
      return `<pre class="generic-code-block"><code>${code}</code></pre>`
    })

    // Convert inline code `code` to proper formatting
    processed = processed.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

    // Convert **bold** to <strong>
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

    // Convert *italic* to <em>
    processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>')

    // Convert numbered lists
    processed = processed.replace(/^(\d+\.\s.*)$/gm, '<li class="numbered-item">$1</li>')
    processed = processed.replace(/(<li class="numbered-item">.*<\/li>)/s, '<ol class="numbered-list">$1</ol>')

    // Convert bullet points
    processed = processed.replace(/^[-*]\s(.*)$/gm, '<li class="bullet-item">$1</li>')
    processed = processed.replace(/(<li class="bullet-item">.*<\/li>)/s, '<ul class="bullet-list">$1</ul>')

    // Convert headers
    processed = processed.replace(/^### (.*)$/gm, '<h3 class="header-3">$1</h3>')
    processed = processed.replace(/^## (.*)$/gm, '<h2 class="header-2">$1</h2>')
    processed = processed.replace(/^# (.*)$/gm, '<h1 class="header-1">$1</h1>')

    // Convert line breaks
    processed = processed.replace(/\n\n/g, '</p><p class="paragraph">')
    processed = processed.replace(/\n/g, '<br>')

    // Wrap in paragraph tags
    processed = `<p class="paragraph">${processed}</p>`

    setProcessedContent(processed)
  }, [content])

  return (
    <div className={`markdown-content ${className}`}>
      <div dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(processedContent) }} />
      
      <style jsx>{`
        .markdown-content {
          line-height: 1.6;
          color: #374151;
        }

        .markdown-content .paragraph {
          margin-bottom: 1rem;
        }

        .markdown-content .header-1 {
          font-size: 1.5rem;
          font-weight: bold;
          color: #60a5fa;
          margin: 1.5rem 0 1rem 0;
          border-bottom: 2px solid #374151;
          padding-bottom: 0.5rem;
        }

        .markdown-content .header-2 {
          font-size: 1.25rem;
          font-weight: bold;
          color: #34d399;
          margin: 1.25rem 0 0.75rem 0;
        }

        .markdown-content .header-3 {
          font-size: 1.125rem;
          font-weight: bold;
          color: #fbbf24;
          margin: 1rem 0 0.5rem 0;
        }

        .markdown-content .inline-code {
          background: #374151;
          color: #fbbf24;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
          font-size: 0.875rem;
          border: 1px solid #4b5563;
        }

        .markdown-content .cpp-code-block {
          background: #1e293b;
          border: 1px solid #475569;
          border-radius: 0.5rem;
          padding: 1rem;
          margin: 1rem 0;
          overflow-x: auto;
          font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .markdown-content .cpp-code-block code {
          color: #e2e8f0;
          background: none;
          padding: 0;
          border: none;
          font-family: inherit;
        }

        .markdown-content .generic-code-block {
          background: #1e293b;
          border: 1px solid #475569;
          border-radius: 0.5rem;
          padding: 1rem;
          margin: 1rem 0;
          overflow-x: auto;
          font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
          font-size: 0.875rem;
          line-height: 1.5;
          color: #e2e8f0;
        }

        .markdown-content .generic-code-block code {
          color: #e2e8f0;
          background: none;
          padding: 0;
          border: none;
          font-family: inherit;
        }

        .markdown-content .numbered-list {
          margin: 1rem 0;
          padding-left: 1.5rem;
        }

        .markdown-content .numbered-item {
          margin: 0.5rem 0;
          color: #e2e8f0;
        }

        .markdown-content .bullet-list {
          margin: 1rem 0;
          padding-left: 1.5rem;
        }

        .markdown-content .bullet-item {
          margin: 0.5rem 0;
          color: #e2e8f0;
          list-style-type: disc;
        }

        .markdown-content strong {
          color: #60a5fa;
          font-weight: bold;
        }

        .markdown-content em {
          color: #fbbf24;
          font-style: italic;
        }

        /* Syntax highlighting for C++ code */
        .markdown-content .cpp-code-block .token.keyword {
          color: #c792ea;
        }

        .markdown-content .cpp-code-block .token.string {
          color: #c3e88d;
        }

        .markdown-content .cpp-code-block .token.number {
          color: #f78c6c;
        }

        .markdown-content .cpp-code-block .token.comment {
          color: #676e95;
          font-style: italic;
        }

        .markdown-content .cpp-code-block .token.function {
          color: #82aaff;
        }

        .markdown-content .cpp-code-block .token.operator {
          color: #89ddff;
        }
      `}</style>
    </div>
  )
}