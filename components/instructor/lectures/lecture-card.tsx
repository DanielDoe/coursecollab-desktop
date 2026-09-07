"use client"

import { ArrowRight, Calendar, Eye, MessageSquare, Play } from "lucide-react"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { lectureSolidThumb, lectureStatusAccent } from "@/lib/lecture-list-theme"
import { formatLectureIndexLabel } from "@/lib/lecture-index-label"
import { cn } from "@/lib/utils"

export type LectureCardData = {
  id: number
  title: string
  week: number
  session?: string | null
  description?: string | null
  isPublished: boolean
  hasDeck?: boolean
  views?: number
  comments?: number
  /** Cycles Color Hunt thumb colors — match student lecture list. */
  index?: number
  viewMode?: "list" | "grid"
}

function StatusPill({ isPublished, accent }: { isPublished: boolean; accent: string }) {
  if (isPublished) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Live
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: `${accent}18`, color: accent }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
      Draft
    </span>
  )
}

export function LectureCard({
  title,
  week,
  session,
  description,
  isPublished,
  hasDeck,
  views,
  comments,
  index = 0,
  viewMode = "list",
  onSelect,
}: LectureCardData & { onSelect: () => void }) {
  const preview = (description ?? "").replace(/\s+/g, " ").trim()
  const thumb = lectureSolidThumb(index, "available")
  const accent = lectureStatusAccent("available", thumb)
  const isList = viewMode === "list"

  return (
    <article
      className={cn(
        "overflow-hidden bg-[var(--card)] text-left transition-colors hover:bg-[var(--cc-accent-soft)]/45",
        isList
          ? "border-0 shadow-none"
          : "border border-[var(--border)] shadow-none",
      )}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex gap-3 p-3 pb-2.5">
          <SolidListThumbTile thumb={thumb} icon={Play} size="list" />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--cc-text)]">{title}</h3>
            <p className="mt-0.5 truncate text-xs text-[var(--cc-text-muted)]">
              {formatLectureIndexLabel(week, { title })}
              {session ? ` · ${session}` : ""}
              {hasDeck ? " · Deck" : ""}
            </p>
            {preview ? (
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--cc-text-muted)]">{preview}</p>
            ) : null}
            <div className="mt-2">
              <StatusPill isPublished={isPublished} accent={accent} />
            </div>
          </div>
        </div>
        <div className="mx-3 border-t border-[var(--border)]/70" />
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
            <span className="inline-flex items-center gap-1 text-xs text-[var(--cc-text-muted)]">
              <Calendar className="h-3.5 w-3.5" />
              {formatLectureIndexLabel(week, { title })}
            </span>
            {views != null ? (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--cc-text-muted)]">
                <Eye className="h-3.5 w-3.5" />
                {views}
              </span>
            ) : null}
            {comments != null ? (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--cc-text-muted)]">
                <MessageSquare className="h-3.5 w-3.5" />
                {comments}
              </span>
            ) : null}
          </div>
          <span
            className="hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white sm:inline-flex"
            style={{ backgroundColor: thumb.fill }}
          >
            Open lecture
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </button>
    </article>
  )
}
