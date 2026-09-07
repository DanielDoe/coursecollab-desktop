"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CodeBlockProps {
  code: string
  language?: string
}

export function CodeBlock({ code, language = "cpp" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Language display names
  const languageNames: Record<string, string> = {
    cpp: "C++",
    c: "C",
    python: "Python",
    javascript: "JavaScript",
    typescript: "TypeScript",
    java: "Java",
    html: "HTML",
    css: "CSS",
    sql: "SQL",
  }

  return (
    <div className="relative group my-4">
      {/* Language badge */}
      <div className="flex items-center justify-between bg-slate-800 text-slate-200 px-4 py-2 rounded-t-lg text-xs font-medium">
        <span>{languageNames[language] || language.toUpperCase()}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-slate-200 hover:text-white hover:bg-slate-700"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Code content */}
      <pre className="bg-slate-900 text-slate-100 p-4 rounded-b-lg overflow-x-auto border-t border-slate-700">
        <code className="text-sm font-mono leading-relaxed">{code}</code>
      </pre>
    </div>
  )
}

// Export JSX type for TypeScript
export type { JSX } from "react"
