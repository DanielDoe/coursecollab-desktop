"use client"

import { Code2, Circle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"

type OpenTab = {
  id: string
  name: string
  dirty?: boolean
}

type Props = {
  lineCount: number
  language?: string
  fileName?: string
  learningMode?: string
  compact?: boolean
  theme?: "light" | "dark"
  dirty?: boolean
  naming?: boolean
  openFiles?: OpenTab[]
  activeFileId?: string | null
  onSelectFile?: (fileId: string) => void
  onCloseFile?: (fileId: string) => void
}

export function CodebenchEditorChrome({
  lineCount,
  language = "C++",
  fileName = "main.cpp",
  learningMode,
  compact,
  theme = "dark",
  dirty = false,
  naming = false,
  openFiles = [],
  activeFileId,
  onSelectFile,
  onCloseFile,
}: Props) {
  const isLight = theme === "light"
  const { accent } = useCodebenchChrome()
  const tabs = openFiles.length > 0 ? openFiles : [{ id: "current", name: fileName, dirty }]

  return (
    <div
      className={cn(
        "@container/cb-chrome flex h-9 min-w-0 shrink-0 items-center gap-2 overflow-hidden border-b px-2.5",
        "border-[var(--border)] bg-[var(--card)]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {tabs.map((tab) => {
          const active = tab.id === (activeFileId ?? "current") || tabs.length === 1
          return (
            <div
              key={tab.id}
              className={cn(
                "flex h-full min-w-0 max-w-[10rem] items-center gap-1 border-b-2 px-1",
                active ? "text-[var(--cc-text)]" : "border-transparent text-[var(--cc-text-muted)]",
              )}
              style={active ? { borderColor: accent } : undefined}
            >
              <button
                type="button"
                className="flex min-w-0 items-center gap-1"
                onClick={() => onSelectFile?.(tab.id)}
              >
                <Code2 className="h-3.5 w-3.5 shrink-0" style={{ color: active ? accent : undefined }} />
                <span className="truncate text-[12px] font-semibold">
                  {tab.dirty ? "• " : ""}
                  {tab.name}
                </span>
              </button>
              {onCloseFile && tabs.length > 1 ? (
                <button
                  type="button"
                  className="rounded px-0.5 text-[10px] text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]"
                  aria-label={`Close ${tab.name}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onCloseFile(tab.id)
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          )
        })}
        {!compact ? (
          <span
            className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-widest text-[var(--cc-text-muted)]"
            title={language}
          >
            {language}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-[11px] text-[var(--cc-text-muted)]">
        {learningMode && !compact ? (
          <span
            className="hidden rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize @[40rem]/cb-chrome:inline-flex"
            style={{
              backgroundColor: `${accent}14`,
              borderColor: `${accent}33`,
              color: accent,
            }}
          >
            {learningMode}
          </span>
        ) : null}
        {naming ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: accent }}>
            <Loader2 className="h-3 w-3 animate-spin" />
            Cora naming
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <Circle className={cn("h-2 w-2 fill-current", isLight ? "text-emerald-500" : "text-emerald-400")} />
          {lineCount} ln
        </span>
      </div>
    </div>
  )
}
