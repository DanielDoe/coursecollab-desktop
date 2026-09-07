"use client"

import { ArrowRight, Calendar, FilePenLine, Type } from "lucide-react"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { displayContentTitle } from "@/components/instructor/dashboard-v2/FacultyContentNavigator"

const noteChrome = facultyEmbedChrome("course-notes")

export const COURSE_NOTE_PAGE_SIZE = 6

export type CourseNoteCardData = {
  id: number
  title: string
  topic?: string | null
  bodyText?: string | null
  isPublished: boolean
  session?: string | null
  updatedAt?: string
}

function formatRelativeUpdated(iso?: string): string {
  if (!iso) return "Recently"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Recently"
  const diffMs = Date.now() - date.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function wordCount(text?: string | null): number {
  const words = (text ?? "").trim().split(/\s+/).filter(Boolean)
  return words.length
}

function StatusPill({ isPublished }: { isPublished: boolean }) {
  if (isPublished) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Live
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      Draft
    </span>
  )
}

export function CourseNoteCard({
  title,
  topic,
  bodyText,
  isPublished,
  session,
  updatedAt,
  selected,
  onSelect,
}: CourseNoteCardData & { selected: boolean; onSelect: () => void }) {
  const topicLabel = topic?.trim() || "General"
  const words = wordCount(bodyText)
  const preview = (bodyText ?? "").replace(/\s+/g, " ").trim()

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-[var(--card)] text-left transition-colors",
        selected
          ? cn(noteChrome.p.softBg, noteChrome.p.border, "ring-1 ring-current/10")
          : "border-[var(--border)] hover:bg-[var(--sidebar-accent)]/25",
      )}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex gap-3 p-3 pb-2.5">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm",
              noteChrome.p.softBg,
            )}
          >
            <FilePenLine className={cn("h-5 w-5", noteChrome.p.iconText)} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--cc-text)]">
              {displayContentTitle(title)}
            </h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {topicLabel}
              {session ? ` · ${session}` : ""}
            </p>
            {preview ? (
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--cc-text-muted)]">
                {preview}
              </p>
            ) : null}
            <div className="mt-2">
              <StatusPill isPublished={isPublished} />
            </div>
          </div>
        </div>

        <div className="mx-3 border-t border-[var(--border)]/70" />

        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
            <StatInline icon={Type} value={String(words)} label={words === 1 ? "Word" : "Words"} />
            <StatInline icon={Calendar} value={formatRelativeUpdated(updatedAt)} label="Updated" />
          </div>
          <span
            className={cn(
              "hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex",
              selected ? cn(noteChrome.cta, "text-white") : cn(noteChrome.p.softBg, noteChrome.p.iconText),
            )}
          >
            Open note
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </button>
    </article>
  )
}

function StatInline({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Type
  value: string
  label: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", noteChrome.p.softBg, noteChrome.p.iconText)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-xs font-semibold tabular-nums text-[var(--cc-text)]">{value}</p>
        <p className="truncate text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

export function CourseNoteList({
  notes,
  selectedNoteId,
  onSelectNote,
  className,
}: {
  notes: CourseNoteCardData[]
  selectedNoteId: number | null
  onSelectNote: (id: number) => void
  className?: string
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {notes.map((note) => (
        <CourseNoteCard
          key={note.id}
          {...note}
          selected={selectedNoteId === note.id}
          onSelect={() => onSelectNote(note.id)}
        />
      ))}
    </div>
  )
}
