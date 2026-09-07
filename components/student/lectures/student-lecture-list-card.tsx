"use client"

import { Bookmark, Bell, CheckCircle2, ChevronRight } from "lucide-react"
import { formatLectureIndexLabel } from "@/lib/lecture-index-label"
import { cn } from "@/lib/utils"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import {
  clampLectureProgress,
  resolveLectureCardKind,
  type LectureListItem,
} from "@/lib/lecture-list-utils"
import {
  lectureSolidThumb,
  lectureStatusAccent,
  lectureStatusLabel,
  lectureThumbIcon,
} from "@/lib/lecture-list-theme"

type Props = {
  lecture: LectureListItem & { id: number; week: number; title: string; created_at?: string }
  index: number
  courseLabel?: string
  onPress: () => void
  disabled?: boolean
  trailing?: React.ReactNode
  compact?: boolean
  viewMode?: "list" | "grid"
}

/** Mobile-style bold lecture row — Color Hunt solid thumbs + status accents. */
export function StudentLectureListCard({
  lecture,
  index,
  courseLabel,
  onPress,
  disabled,
  trailing,
  compact,
  viewMode = "list",
}: Props) {
  const kind = resolveLectureCardKind(lecture)
  const progress = clampLectureProgress(lecture.progress_percentage)
  const thumb = lectureSolidThumb(index, kind)
  const statusColor = lectureStatusAccent(kind, thumb)
  const Icon = lectureThumbIcon(kind)
  const locked = kind === "locked" || disabled
  const showProgress = kind === "in_progress" || kind === "completed"

  if (viewMode === "grid") {
    return (
      <div
        className={cn(
          "flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors",
          !locked && "hover:bg-[var(--muted)]/30",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            disabled={locked}
            onClick={onPress}
            className={cn(locked ? "cursor-not-allowed opacity-70" : "cursor-pointer")}
          >
            <SolidListThumbTile thumb={thumb} icon={Icon} size="list" />
          </button>
          {trailing}
        </div>
        <button
          type="button"
          disabled={locked}
          onClick={onPress}
          className={cn(
            "mt-3 flex min-w-0 flex-1 flex-col items-start text-left",
            locked ? "cursor-not-allowed opacity-70" : "cursor-pointer",
          )}
        >
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--cc-text)]">{lecture.title}</p>
          <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
            {courseLabel ?? formatLectureIndexLabel(lecture.week, { title: lecture.title })}
          </p>
          <div className="mt-auto flex w-full items-center gap-2 pt-3">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {kind === "completed" ? (
                <CheckCircle2 className="size-3.5 shrink-0" style={{ color: statusColor }} aria-hidden />
              ) : (
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: statusColor }} aria-hidden />
              )}
              <span className="text-[11px] font-semibold" style={{ color: statusColor }}>
                {lectureStatusLabel(kind)}
              </span>
              <span className="text-[11px] text-[var(--cc-text-muted)]">• {progress}% viewed</span>
            </div>
          </div>
          {showProgress ? (
            <div
              className="mt-2 h-1 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: `${thumb.fill}29` }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${kind === "completed" ? Math.max(progress, 100) : Math.max(progress, 4)}%`,
                  backgroundColor: statusColor,
                }}
              />
            </div>
          ) : null}
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex h-[88px] items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors",
        !locked && "hover:bg-[var(--muted)]/30",
        compact && "h-[76px]",
      )}
    >
      <button
        type="button"
        disabled={locked}
        onClick={onPress}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 text-left",
          locked ? "cursor-not-allowed opacity-70" : "cursor-pointer",
        )}
      >
        <SolidListThumbTile thumb={thumb} icon={Icon} size={compact ? "compact" : "list"} />

        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--cc-text)]">{lecture.title}</p>
          {courseLabel ? (
            <p className="truncate text-xs text-[var(--cc-text-muted)]">{courseLabel}</p>
          ) : (
            <p className="truncate text-xs text-[var(--cc-text-muted)]">
              {formatLectureIndexLabel(lecture.week, { title: lecture.title })}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {kind === "completed" ? (
                <CheckCircle2 className="size-3.5 shrink-0" style={{ color: statusColor }} aria-hidden />
              ) : (
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: statusColor }}
                  aria-hidden
                />
              )}
              <span className="text-[11px] font-semibold" style={{ color: statusColor }}>
                {lectureStatusLabel(kind)}
              </span>
              <span className="text-[11px] text-[var(--cc-text-muted)]">• {progress}% viewed</span>
            </div>

            {showProgress ? (
              <div
                className="h-1 w-[52px] shrink-0 overflow-hidden rounded-full"
                style={{ backgroundColor: `${thumb.fill}29` }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${kind === "completed" ? Math.max(progress, 100) : Math.max(progress, 4)}%`,
                    backgroundColor: statusColor,
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>

        {!trailing ? (
          <ChevronRight className="size-4 shrink-0 text-[var(--cc-text-muted)]" aria-hidden />
        ) : null}
      </button>

      {trailing}
    </div>
  )
}

export function StudentLectureListCardActions({
  isBookmarked,
  hasReminder,
  onToggleBookmark,
  onSetReminder,
}: {
  isBookmarked: boolean
  hasReminder: boolean
  onToggleBookmark: () => void
  onSetReminder: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 pl-1">
      <button
        type="button"
        onClick={onToggleBookmark}
        className={cn(
          "rounded-lg p-1.5 text-[var(--cc-text-muted)] transition-colors hover:bg-[var(--muted)]",
          isBookmarked && "text-[var(--cc-warning)]",
        )}
        aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
      >
        <Bookmark className={cn("size-4", isBookmarked && "fill-current")} />
      </button>
      <button
        type="button"
        onClick={onSetReminder}
        disabled={hasReminder}
        className={cn(
          "rounded-lg p-1.5 text-[var(--cc-text-muted)] transition-colors hover:bg-[var(--muted)] disabled:opacity-40",
          hasReminder && "text-[var(--cc-accent)]",
        )}
        aria-label="Set reminder"
      >
        <Bell className="size-4" />
      </button>
    </div>
  )
}
