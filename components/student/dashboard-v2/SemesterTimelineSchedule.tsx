"use client"

import Link from "next/link"
import {
  addDays,
  format,
  isToday,
  max as maxDate,
  min as minDate,
  startOfDay,
} from "date-fns"
import type { LucideIcon } from "lucide-react"
import {
  ArrowUpRight,
  BookOpen,
  ClipboardList,
  Code2,
  FileText,
  GraduationCap,
  ScrollText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  timelineStatusLabel,
  TIMELINE_TYPE_LABELS,
  type SemesterTimelineItem,
} from "@/lib/student-semester-timeline"
import { TIMELINE_STATUS_COLORS } from "@/lib/student-color-hunt-theme"

const TYPE_ICONS = {
  quiz: ClipboardList,
  homework: BookOpen,
  midterm: FileText,
  final: GraduationCap,
  code_submission: Code2,
  syllabus: ScrollText,
} as const

const TYPE_ACCENT: Record<SemesterTimelineItem["type"], string> = {
  quiz: "#06B6D4",
  homework: "#EC4899",
  midterm: "#6366F1",
  final: "#8B5CF6",
  code_submission: "#F59E0B",
  syllabus: "#64748B",
}

function itemAnchorDate(item: SemesterTimelineItem): Date {
  return startOfDay(new Date(item.sortAt))
}

function itemWindow(item: SemesterTimelineItem): { start: Date | null; end: Date | null } {
  const start = item.opensAt ? startOfDay(new Date(item.opensAt)) : null
  const end = item.dueDate ? startOfDay(new Date(item.dueDate)) : null
  return { start, end }
}

function formatWhenShort(item: SemesterTimelineItem): string {
  const { start, end } = itemWindow(item)
  if (item.status === "coming_soon" && start) {
    return `Opens ${format(start, "MMM d")}`
  }
  if (end) return `Due ${format(end, "MMM d, h:mm a")}`
  if (item.dateLabel) return item.dateLabel
  if (start) return format(start, "MMM d, yyyy")
  return format(itemAnchorDate(item), "MMM d, yyyy")
}

function semesterBounds(items: SemesterTimelineItem[]): { start: Date; end: Date } {
  const now = startOfDay(new Date())
  if (items.length === 0) {
    return { start: addDays(now, -14), end: addDays(now, 60) }
  }
  const dates = items.flatMap((item) => {
    const anchor = itemAnchorDate(item)
    const { start, end } = itemWindow(item)
    return [anchor, start, end].filter(Boolean) as Date[]
  })
  const start = minDate(dates)
  const end = maxDate(dates)
  const paddedStart = addDays(start, -7)
  const paddedEnd = addDays(end, 14)
  if (paddedEnd.getTime() <= paddedStart.getTime()) {
    return { start: paddedStart, end: addDays(paddedStart, 90) }
  }
  return { start: paddedStart, end: paddedEnd }
}

function positionOnSemester(date: Date, start: Date, end: Date): number {
  const total = end.getTime() - start.getTime()
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, ((date.getTime() - start.getTime()) / total) * 100))
}

function StatusBadge({
  item,
  compact,
}: {
  item: SemesterTimelineItem
  compact?: boolean
}) {
  const color = TIMELINE_STATUS_COLORS[item.status]
  const positive = item.status === "open" || item.status === "completed"
  return (
    <span
      className={cn(
        "shrink-0 rounded-full font-semibold uppercase tracking-wide",
        compact ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-0.5 text-[10px]",
      )}
      style={{
        backgroundColor: positive ? `${color}22` : `${color}18`,
        color,
      }}
    >
      {timelineStatusLabel(item.status)}
    </span>
  )
}

function WindowBar({
  item,
  bounds,
  compact,
}: {
  item: SemesterTimelineItem
  bounds: { start: Date; end: Date }
  compact?: boolean
}) {
  const { start, end } = itemWindow(item)
  const anchor = itemAnchorDate(item)
  const barStart = start ?? anchor
  const barEnd = end ?? addDays(anchor, 1)
  const left = positionOnSemester(barStart, bounds.start, bounds.end)
  const right = positionOnSemester(barEnd, bounds.start, bounds.end)
  const width = Math.max(4, right - left)
  const color = TIMELINE_STATUS_COLORS[item.status]

  if (compact || (!start && !end)) return null

  return (
    <div className={cn("relative w-full", compact ? "mt-1 h-1" : "mt-2 h-1.5")}>
      <div className="absolute inset-0 rounded-full bg-[var(--muted)]/60" />
      <div
        className="absolute top-0 h-full rounded-full"
        style={{
          left: `${left}%`,
          width: `${width}%`,
          backgroundColor: color,
          opacity: item.status === "completed" ? 0.45 : 0.85,
        }}
      />
    </div>
  )
}

function ScheduleRow({
  item,
  bounds,
  compact,
  isLast,
}: {
  item: SemesterTimelineItem
  bounds: { start: Date; end: Date }
  compact?: boolean
  isLast?: boolean
}) {
  const Icon: LucideIcon = TYPE_ICONS[item.type]
  const accent = TYPE_ACCENT[item.type]
  const locked = item.status === "coming_soon" || item.status === "syllabus"
  const href = locked ? undefined : (item.href ?? item.moduleHref)
  const anchor = itemAnchorDate(item)
  const dayLabel = format(anchor, "MMM d")
  const weekday = format(anchor, "EEE")
  const typeLabel = TIMELINE_TYPE_LABELS[item.type]
  const when = formatWhenShort(item)
  const statusColor = TIMELINE_STATUS_COLORS[item.status]

  const scoreLine =
    item.status === "completed" && item.gradeReleased && typeof item.score === "number"
      ? `${item.score}%`
      : item.status === "completed" && !item.gradeReleased
        ? "Under review"
        : null

  const inner = (
    <div
      className={cn(
        "group relative flex min-w-0 gap-3 sm:gap-4",
        compact ? "py-2" : "py-3",
        href && "cursor-pointer",
      )}
    >
      <div className="flex w-14 shrink-0 flex-col items-end pt-0.5 sm:w-16">
        <span className="text-xs font-bold tabular-nums text-[var(--cc-text)]">{dayLabel}</span>
        <span className="text-[10px] uppercase tracking-wide text-[var(--cc-text-muted)]">{weekday}</span>
        {isToday(anchor) ? (
          <span className="mt-1 rounded-full bg-[var(--cc-accent-soft)] px-1.5 py-0.5 text-[8px] font-bold uppercase text-[var(--cc-accent-dark)]">
            Today
          </span>
        ) : null}
      </div>

      <div className="relative flex w-5 shrink-0 justify-center sm:w-6">
        {!isLast ? (
          <span
            className="absolute top-4 bottom-0 w-px bg-[var(--border)]"
            aria-hidden
          />
        ) : null}
        <span
          className={cn(
            "relative z-10 mt-1 rounded-full ring-4 ring-[var(--card)]",
            compact ? "size-2.5" : "size-3",
          )}
          style={{ backgroundColor: statusColor }}
        />
      </div>

      <div
        className={cn(
          "min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] transition-colors",
          compact ? "px-3 py-2.5" : "px-3.5 py-3 sm:px-4",
          href && "group-hover:border-[var(--cc-accent)]/35 group-hover:bg-[var(--cc-accent-soft)]/20",
        )}
      >
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg text-white shadow-sm",
              compact ? "size-8" : "size-9",
            )}
            style={{ backgroundColor: accent }}
          >
            <Icon className={compact ? "size-3.5" : "size-4"} strokeWidth={2} aria-hidden />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: accent }}
                  >
                    {typeLabel}
                  </span>
                  {scoreLine ? (
                    <span className="text-[10px] font-semibold tabular-nums text-[var(--cc-text-muted)]">
                      {scoreLine}
                    </span>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "mt-1 font-semibold leading-snug text-[var(--cc-text)]",
                    compact ? "text-sm" : "text-[15px]",
                  )}
                >
                  {item.title}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--cc-text-muted)]">{when}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <StatusBadge item={item} compact={compact} />
                {href ? (
                  <ArrowUpRight className="size-3.5 text-[var(--cc-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                ) : null}
              </div>
            </div>
            <WindowBar item={item} bounds={bounds} compact={compact} />
          </div>
        </div>
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]">
        {inner}
      </Link>
    )
  }
  return inner
}

export function SemesterScheduleView({
  items,
  compact,
  className,
}: {
  items: SemesterTimelineItem[]
  compact?: boolean
  className?: string
}) {
  const bounds = semesterBounds(items)

  if (items.length === 0) return null

  return (
    <div className={className}>
      <div className={cn(compact ? "space-y-0" : "space-y-0.5")}>
        {items.map((item, index) => (
          <ScheduleRow
            key={item.id}
            item={item}
            bounds={bounds}
            compact={compact}
            isLast={index === items.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

export function SemesterScheduleTable({
  items,
  className,
}: {
  items: SemesterTimelineItem[]
  className?: string
}) {
  if (items.length === 0) return null

  return (
    <div className={cn("overflow-x-auto rounded-xl border border-[var(--border)]", className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30 text-[10px] font-semibold uppercase tracking-wider text-[var(--cc-text-muted)]">
            <th className="px-3 py-2.5 sm:px-4">Date</th>
            <th className="px-3 py-2.5 sm:px-4">Type</th>
            <th className="px-3 py-2.5 sm:px-4">Assignment</th>
            <th className="px-3 py-2.5 sm:px-4">Window</th>
            <th className="px-3 py-2.5 sm:px-4">Status</th>
            <th className="px-3 py-2.5 sm:px-4" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const anchor = itemAnchorDate(item)
            const locked = item.status === "coming_soon" || item.status === "syllabus"
            const href = locked ? undefined : (item.href ?? item.moduleHref)
            const accent = TYPE_ACCENT[item.type]
            const { start, end } = itemWindow(item)
            const windowLabel =
              start && end
                ? `${format(start, "MMM d")} → ${format(end, "MMM d")}`
                : start
                  ? `Opens ${format(start, "MMM d")}`
                  : end
                    ? `Due ${format(end, "MMM d")}`
                    : format(anchor, "MMM d, yyyy")

            return (
              <tr
                key={item.id}
                className={cn(
                  "border-b border-[var(--border)] last:border-0",
                  href && "hover:bg-[var(--cc-accent-soft)]/15",
                )}
              >
                <td className="px-3 py-3 align-top sm:px-4">
                  <div className="font-semibold tabular-nums text-[var(--cc-text)]">{format(anchor, "MMM d")}</div>
                  <div className="text-[10px] uppercase text-[var(--cc-text-muted)]">{format(anchor, "EEE")}</div>
                </td>
                <td className="px-3 py-3 align-top sm:px-4">
                  <span
                    className="inline-block rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase text-white"
                    style={{ backgroundColor: accent }}
                  >
                    {TIMELINE_TYPE_LABELS[item.type]}
                  </span>
                </td>
                <td className="max-w-[220px] px-3 py-3 align-top font-medium text-[var(--cc-text)] sm:max-w-none sm:px-4">
                  {item.title}
                </td>
                <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-[var(--cc-text-muted)] sm:px-4">
                  {windowLabel}
                </td>
                <td className="px-3 py-3 align-top sm:px-4">
                  <StatusBadge item={item} />
                </td>
                <td className="px-3 py-3 align-top sm:px-4">
                  {href ? (
                    <Link
                      href={href}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--cc-accent-dark)] hover:underline"
                    >
                      Open
                      <ArrowUpRight className="size-3" />
                    </Link>
                  ) : (
                    <span className="text-xs text-[var(--cc-text-muted)]">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
