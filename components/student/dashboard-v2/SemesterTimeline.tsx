"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { LayoutGrid, ListTree } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  resolveStudentDatabaseId,
  resolveStudentDisplayId,
  resolveStudentSection,
} from "@/lib/auth"
import { getStudentSemesterTimeline } from "@/lib/student-semester-timeline-client"
import {
  filterTimelineByStatus,
  type SemesterTimelineItem,
  type SemesterTimelineStatus,
} from "@/lib/student-semester-timeline"
import { STUDENT_CONTENT } from "@/lib/student-color-hunt-theme"
import { CardWrapper } from "./CardWrapper"
import {
  SemesterScheduleTable,
  SemesterScheduleView,
} from "./SemesterTimelineSchedule"

type Filter = "all" | SemesterTimelineStatus
type ViewMode = "timeline" | "table"

type Props = {
  compact?: boolean
  limit?: number
  showFilters?: boolean
  showViewToggle?: boolean
  className?: string
}

export function SemesterTimeline({
  compact = false,
  limit,
  showFilters = !compact,
  showViewToggle = !compact,
  className,
}: Props) {
  const [items, setItems] = useState<SemesterTimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("all")
  const [viewMode, setViewMode] = useState<ViewMode>("timeline")

  useEffect(() => {
    const dbId = resolveStudentDatabaseId()
    const displayId = resolveStudentDisplayId()
    const section = resolveStudentSection()
    if (!dbId) {
      setLoading(false)
      return
    }

    getStudentSemesterTimeline(dbId, displayId || dbId, section)
      .then(setItems)
      .catch((e) => {
        console.error("[SemesterTimeline] Failed:", e)
        setItems([])
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => filterTimelineByStatus(items, filter), [items, filter])
  const visible = limit ? filtered.slice(0, limit) : filtered

  const filterCounts = useMemo(() => {
    const counts: Record<Filter, number> = {
      all: items.length,
      coming_soon: 0,
      open: 0,
      past_due: 0,
      completed: 0,
      syllabus: 0,
    }
    for (const item of items) counts[item.status]++
    return counts
  }, [items])

  const statusSummary = useMemo(() => {
    const open = items.filter((i) => i.status === "open").length
    const upcoming = items.filter((i) => i.status === "coming_soon").length
    const due = items.filter((i) => i.status === "past_due").length
    return { open, upcoming, due }
  }, [items])

  if (loading) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-2xl bg-[var(--muted)]",
          compact ? "h-48" : "h-72",
          className,
        )}
      />
    )
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "coming_soon", label: "Coming soon" },
    { id: "open", label: "Open" },
    { id: "past_due", label: "Past due" },
    { id: "completed", label: "Done" },
    { id: "syllabus", label: "Syllabus" },
  ]

  return (
    <div className={className}>
      {!compact && items.length > 0 ? (
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {[
            { label: "Open now", value: statusSummary.open, tone: "text-emerald-600 dark:text-emerald-400" },
            { label: "Coming soon", value: statusSummary.upcoming, tone: "text-amber-600 dark:text-amber-400" },
            { label: "Past due", value: statusSummary.due, tone: "text-red-600 dark:text-red-400" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2.5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cc-text-muted)]">
                {stat.label}
              </p>
              <p className={cn("mt-0.5 text-2xl font-bold tabular-nums", stat.tone)}>{stat.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {showFilters && items.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => {
              const count = filterCounts[f.id]
              if (f.id !== "all" && count === 0) return null
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    filter === f.id
                      ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                      : "border-[var(--border)] text-[var(--cc-text-muted)] hover:border-[var(--cc-accent)]/40",
                  )}
                >
                  {f.label}
                  {count > 0 ? ` (${count})` : ""}
                </button>
              )
            })}
          </div>

          {showViewToggle ? (
            <div className="flex rounded-lg border border-[var(--border)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("timeline")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "timeline"
                    ? "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                    : "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
                )}
              >
                <ListTree className="size-3.5" />
                Timeline
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "table"
                    ? "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                    : "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
                )}
              >
                <LayoutGrid className="size-3.5" />
                Table
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--cc-text-muted)]">
          {items.length === 0
            ? "No scheduled assignments yet. Check the syllabus or ask your instructor when items will be posted."
            : "No items match this filter."}
        </p>
      ) : viewMode === "table" && !compact ? (
        <SemesterScheduleTable items={visible} />
      ) : (
        <SemesterScheduleView items={visible} compact={compact} />
      )}
    </div>
  )
}

export function SemesterTimelinePanel() {
  return (
    <CardWrapper delay={0.2} hover={false}>
      <div className="p-4 sm:p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--cc-text-muted)]">
              Semester Timeline
            </h3>
            <p className="mt-1 text-sm text-[var(--cc-text-secondary)]">
              Upcoming dates, open work, and completed assignments
            </p>
          </div>
          <Link
            href="/student/dashboard-v2/timeline"
            className="shrink-0 text-xs font-semibold uppercase tracking-wide hover:underline"
            style={{ color: STUDENT_CONTENT.link }}
          >
            View all
          </Link>
        </div>
        <SemesterTimeline compact limit={6} showFilters={false} />
      </div>
    </CardWrapper>
  )
}
