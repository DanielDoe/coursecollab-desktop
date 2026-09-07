"use client"

import ReactMarkdown from "react-markdown"

interface PseudocodeRendererProps {
  content: string
}

export function PseudocodeRenderer({ content }: PseudocodeRendererProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none bg-slate-900/50 p-4 rounded-lg border border-slate-700">
      <ReactMarkdown
        components={{
          code: ({ node, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || "")
            return match ? (
              <code className={className} {...props}>
                {children}
              </code>
            ) : (
              <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sm" {...props}>
                {children}
              </code>
            )
          },
          pre: ({ children }: any) => (
            <pre className="bg-slate-800 p-4 rounded-lg overflow-x-auto border border-slate-700">
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
