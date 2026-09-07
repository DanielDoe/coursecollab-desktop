"use client"

import { ChevronRight, FilePenLine, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { PORTAL_CARD } from "@/lib/appearance/portal-nav-classes"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"

export type CourseNoteTopicCardData = {
  name: string
  note_count: number
}

type Props = {
  topic: CourseNoteTopicCardData
  viewMode: "grid" | "list"
  onOpen: () => void
}

const MODULE_ID = "course-notes"

export function CourseNoteTopicCard({ topic, viewMode, onOpen }: Props) {
  const chrome = facultyEmbedChrome(MODULE_ID)
  const noteLabel = `${topic.note_count} note${topic.note_count === 1 ? "" : "s"}`

  if (viewMode === "list") {
    return (
      <article
        className={cn(
          PORTAL_CARD,
          "group relative overflow-hidden transition-all",
          "hover:border-[var(--cc-accent)]/30 hover:shadow-md hover:shadow-[var(--cc-accent)]/5",
        )}
      >
        <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-3 py-3 sm:px-4 text-left">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              chrome.p.softBg,
            )}
          >
            <FolderOpen className={cn("h-4 w-4", chrome.p.iconText)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--cc-text)] truncate">{topic.name}</p>
            <p className="text-xs text-[var(--cc-text-muted)] mt-0.5">{noteLabel}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)] opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
        </button>
      </article>
    )
  }

  return (
    <article
      className={cn(
        PORTAL_CARD,
        "group relative overflow-hidden transition-all",
        "hover:border-[var(--cc-accent)]/35 hover:shadow-lg hover:shadow-[var(--cc-accent)]/8 hover:-translate-y-0.5",
      )}
    >
      <button type="button" onClick={onOpen} className="relative flex h-full w-full flex-col p-4 sm:p-5 text-left">
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm",
              "bg-[var(--cc-accent-soft)]",
            )}
          >
            <FolderOpen className={cn("h-5 w-5", chrome.p.iconText)} />
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)] opacity-40 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 mt-1" />
        </div>
        <h3 className="mt-4 text-base font-semibold leading-snug text-[var(--cc-text)] line-clamp-2">{topic.name}</h3>
        <div className="mt-auto pt-4">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium",
              chrome.p.softBg,
              chrome.p.iconText,
            )}
          >
            <FilePenLine className="h-3 w-3 opacity-80" />
            {noteLabel}
          </span>
        </div>
      </button>
    </article>
  )
}

type NoteRowProps = {
  title: string
  isPublished: boolean
  selected: boolean
  onSelect: () => void
}

export function CourseNoteTopicNoteRow({ title, isPublished, selected, onSelect }: NoteRowProps) {
  const chrome = facultyEmbedChrome(MODULE_ID)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
        selected
          ? cn("border-[var(--cc-accent)]/40 shadow-sm", chrome.p.softBg)
          : "border-transparent bg-[var(--sidebar-accent)]/25 hover:border-[var(--border)] hover:bg-[var(--sidebar-accent)]/45",
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--cc-accent-soft)]">
          <FilePenLine className="h-3.5 w-3.5 opacity-80" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-medium", selected && chrome.p.iconText)}>{title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{isPublished ? "Live" : "Draft"}</p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
      </div>
    </button>
  )
}
