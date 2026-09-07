"use client"

import { useMemo, useState } from "react"
import { Check, Copy, Download, Expand, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Props = {
  content: Record<string, unknown>
}

function flag(value: unknown, defaultValue = true): boolean {
  if (value === false) return false
  if (value === true) return true
  return defaultValue
}

function CodePanel({
  code,
  allowLineNumbers,
  expanded,
  className,
}: {
  code: string
  allowLineNumbers: boolean
  expanded: boolean
  className?: string
}) {
  const lines = useMemo(() => code.split("\n"), [code])

  return (
    <pre
      className={cn(
        "overflow-auto text-sm font-mono bg-slate-950 text-emerald-300",
        expanded ? "max-h-none flex-1 min-h-0" : "max-h-[480px]",
        className,
      )}
    >
      <code className={cn("block", allowLineNumbers && "table w-full")}>
        {allowLineNumbers
          ? lines.map((line, i) => (
              <span key={i} className="table-row">
                <span className="table-cell select-none pr-4 text-right text-slate-600 align-top w-10">
                  {i + 1}
                </span>
                <span className="table-cell whitespace-pre-wrap break-all align-top">{line || " "}</span>
              </span>
            ))
          : code}
      </code>
    </pre>
  )
}

export function CampCodeLabBlock({ content }: Props) {
  const code = String(content.code ?? "")
  const language = String(content.language ?? "code")
  const title = String(content.title ?? "").trim()
  const description = String(content.description ?? "").trim()
  const filename = String(content.filename ?? "program.py").trim()
  const downloadFilename = String(content.downloadFilename ?? content.filename ?? "program.py").trim()
  const runInstructions = String(content.runInstructions ?? "").trim()

  const allowCopy = flag(content.studentCopyEnabled ?? content.allowCopy, true)
  const allowDownload = flag(content.studentDownloadEnabled ?? content.allowDownload, true)
  const showFilename = flag(content.showFilename, Boolean(filename))
  const showDescription = flag(content.showDescription, Boolean(description))
  const showRunInstructions = flag(content.showRunInstructions, Boolean(runInstructions))
  const allowExpand = flag(content.allowExpand, true)
  const allowFullscreen = flag(content.allowFullscreen, true)
  const allowLineNumbers = flag(content.allowLineNumbers, true)

  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const downloadCode = () => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = downloadFilename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const header = (
    <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border-b border-dashboard-v2-border flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0 space-y-0.5">
        {title ? <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</p> : null}
        {showDescription && description ? (
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
        ) : null}
        {showFilename ? (
          <p className="text-xs font-mono text-slate-500">
            {filename} · {language}
          </p>
        ) : (
          <p className="text-xs font-mono text-slate-500">{language}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {allowExpand ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
            {expanded ? "Collapse" : "Expand"}
          </Button>
        ) : null}
        {allowFullscreen ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => setFullscreen(true)}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Fullscreen
          </Button>
        ) : null}
        {allowCopy ? (
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => void copyCode()}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        ) : null}
        {allowDownload ? (
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={downloadCode}>
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        ) : null}
      </div>
    </div>
  )

  return (
    <>
      <div className="rounded-xl border border-dashboard-v2-border overflow-hidden">
        {header}
        <CodePanel code={code} allowLineNumbers={allowLineNumbers} expanded={expanded} className="p-4" />
        {showRunInstructions && runInstructions ? (
          <div className="border-t border-dashboard-v2-border bg-slate-50 dark:bg-slate-900/50 px-3 py-3 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              Run Instructions
            </p>
            <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{runInstructions}</pre>
          </div>
        ) : null}
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[min(96vw,1200px)] w-full h-[min(92vh,900px)] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="text-left">{title || filename}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="px-4 py-2 border-b shrink-0 flex flex-wrap gap-2 justify-end">
              {allowCopy ? (
                <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => void copyCode()}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              ) : null}
              {allowDownload ? (
                <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={downloadCode}>
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              ) : null}
            </div>
            <CodePanel code={code} allowLineNumbers={allowLineNumbers} expanded className="p-4 flex-1" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
