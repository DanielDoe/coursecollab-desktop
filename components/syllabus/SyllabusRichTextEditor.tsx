"use client"

import { Bold, Heading2, Italic, List, ListOrdered } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { SyllabusMarkdown } from "@/components/syllabus/SyllabusMarkdown"
import { SyllabusAccentProvider } from "@/lib/syllabus/syllabus-accent"
import {
  SYLLABUS_INLINE_PREVIEW,
  SYLLABUS_LABEL,
  PORTAL_CARD,
} from "@/lib/syllabus/syllabus-surface-classes"
import { cn } from "@/lib/utils"

type SyllabusRichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
  className?: string
}

function wrapSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string,
): { next: string; cursor: number } {
  const selected = value.slice(selectionStart, selectionEnd)
  const next =
    value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd)
  const cursor = selectionStart + before.length + selected.length + after.length
  return { next, cursor }
}

export function SyllabusRichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = "min-h-[140px]",
  className,
}: SyllabusRichTextEditorProps) {
  const applyFormat = (before: string, after: string) => {
    const el = document.getElementById("syllabus-rich-text") as HTMLTextAreaElement | null
    if (!el) return
    const { selectionStart, selectionEnd } = el
    const { next, cursor } = wrapSelection(value, selectionStart, selectionEnd, before, after)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(cursor, cursor)
    })
  }

  const applyLinePrefix = (prefix: string) => {
    const el = document.getElementById("syllabus-rich-text") as HTMLTextAreaElement | null
    if (!el) return
    const { selectionStart, selectionEnd } = el
    const before = value.slice(0, selectionStart)
    const selected = value.slice(selectionStart, selectionEnd)
    const after = value.slice(selectionEnd)
    const lines = (selected || " ").split("\n")
    const formatted = lines.map((line) => `${prefix}${line}`).join("\n")
    const next = before + formatted + after
    onChange(next)
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className={cn(PORTAL_CARD, "flex flex-wrap gap-1 p-1")}>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 rounded-lg" onClick={() => applyFormat("**", "**")}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 rounded-lg" onClick={() => applyFormat("*", "*")}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 rounded-lg" onClick={() => applyLinePrefix("## ")}>
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 rounded-lg" onClick={() => applyLinePrefix("- ")}>
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 rounded-lg" onClick={() => applyLinePrefix("1. ")}>
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>
      <Textarea
        id="syllabus-rich-text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Write content using markdown formatting..."}
        className={cn(
          "rounded-lg border-0 bg-[var(--muted)] font-mono text-sm text-[var(--cc-text)] shadow-none placeholder:text-[var(--cc-text-muted)]",
          minHeight,
        )}
      />
      {value.trim() ? (
        <div className={SYLLABUS_INLINE_PREVIEW}>
          <p className={cn("mb-3", SYLLABUS_LABEL)}>Preview</p>
          <SyllabusAccentProvider accent="portal">
            <SyllabusMarkdown content={value} />
          </SyllabusAccentProvider>
        </div>
      ) : null}
    </div>
  )
}
