"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  History,
  ChevronDown,
  Loader2,
  ArrowRight,
  User,
  Bot,
  Shield,
  Sparkles,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import type { AttemptScoreHistoryRow } from "@/lib/attempt-score-history"
import { getStudentAuthHeaders } from "@/lib/auth"
import { getFacultyResultsDetailTheme } from "@/lib/results/faculty-results-detail-ui"
import { cn } from "@/lib/utils"

const HISTORY_PAGE_SIZE = 5
const HISTORY_SCROLL_MAX_H = "max-h-[min(22rem,50vh)]"

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function formatPct(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null
  return `${Math.min(100, Math.max(0, value)).toFixed(1)}%`
}

function scoreDisplay(row: AttemptScoreHistoryRow, which: "prev" | "next"): string {
  const pct = which === "prev" ? row.previous_percentage : row.new_percentage
  const score = which === "prev" ? row.previous_score : row.new_score
  const formatted = formatPct(pct)
  if (formatted) return formatted
  if (score != null && Number.isFinite(score)) {
    const total = row.total_points
    if (total != null && total > 0 && total !== 100) {
      return `${Number(score).toFixed(1)} / ${total} pts`
    }
    return `${Number(score).toFixed(1)}%`
  }
  return "—"
}

function scoreDelta(row: AttemptScoreHistoryRow): number | null {
  const prev = row.previous_percentage
  const next = row.new_percentage
  if (prev == null || next == null) return null
  return Math.round((next - prev) * 10) / 10
}

function actorDisplay(row: AttemptScoreHistoryRow): { label: string; Icon: typeof User } {
  const label = row.actor_label?.trim()
  if (label && !/^\d+$/.test(label)) {
    return { label, Icon: row.actor_type === "ai" ? Bot : User }
  }
  if (row.actor_type === "instructor") return { label: "Instructor", Icon: User }
  if (row.actor_type === "student") return { label: "Student", Icon: User }
  if (row.actor_type === "ai") return { label: "Quiz Master (AI)", Icon: Bot }
  if (row.actor_type === "admin") return { label: "Admin", Icon: Shield }
  return { label: "System", Icon: Sparkles }
}

function deltaTone(delta: number | null): string {
  if (delta == null || Math.abs(delta) < 0.05) {
    return "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60"
  }
  if (delta > 0) {
    return "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
  }
  return "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40"
}

function HistoryEntry({
  row,
  showConnector,
}: {
  row: AttemptScoreHistoryRow
  showConnector: boolean
}) {
  const delta = scoreDelta(row)
  const { label: actorLabel, Icon: ActorIcon } = actorDisplay(row)

  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {showConnector && (
        <span
          className="absolute left-[11px] top-7 bottom-0 w-px bg-slate-200 dark:bg-slate-600/70"
          aria-hidden
        />
      )}
      <span className="relative z-10 mt-1.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 bg-[var(--cc-accent)] shadow-sm">
        <span className="h-2 w-2 rounded-full bg-white" />
      </span>
      <div className="min-w-0 flex-1 rounded-xl border border-slate-200/70 dark:border-slate-600/50 bg-white/90 dark:bg-slate-900/50 px-3.5 py-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className="font-medium text-sm text-slate-800 dark:text-slate-100 leading-snug">
            {row.source_label}
          </p>
          <time
            className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap"
            dateTime={row.created_at}
          >
            {formatWhen(row.created_at)}
          </time>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100/90 dark:bg-slate-800/80 px-2.5 py-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">From</span>
            <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {scoreDisplay(row, "prev")}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 dark:text-slate-400">To</span>
            <span className="font-bold tabular-nums text-slate-900 dark:text-white">
              {scoreDisplay(row, "next")}
            </span>
          </div>
          {delta != null && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${deltaTone(delta)}`}
            >
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}%
            </span>
          )}
          {row.attempt_number != null && (
            <span className="text-xs text-slate-500 dark:text-slate-400 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5">
              Attempt #{row.attempt_number}
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-start gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 shrink-0">
            <ActorIcon className="h-3 w-3" />
            {actorLabel}
          </span>
          {row.change_reason && (
            <>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-slate-600 dark:text-slate-300">{row.change_reason}</span>
            </>
          )}
        </div>
      </div>
    </li>
  )
}

export function AttemptScoreHistoryPanel({
  attemptId,
  quizId,
  studentId,
  userType = "student",
  embedInDashboard = false,
  className = "",
  refreshKey = 0,
}: {
  attemptId: number
  quizId?: number
  studentId?: string | number
  userType?: "student" | "instructor" | "admin"
  embedInDashboard?: boolean
  className?: string
  refreshKey?: number
}) {
  const fr = getFacultyResultsDetailTheme(embedInDashboard, userType)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<AttemptScoreHistoryRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const paginatedHistory = useMemo(() => {
    const start = (safePage - 1) * HISTORY_PAGE_SIZE
    return history.slice(start, start + HISTORY_PAGE_SIZE)
  }, [history, safePage])

  const rangeStart = history.length === 0 ? 0 : (safePage - 1) * HISTORY_PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * HISTORY_PAGE_SIZE, history.length)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (quizId && studentId != null && String(studentId).trim()) {
        params.set("quizId", String(quizId))
        params.set("studentId", String(studentId))
      } else {
        params.set("attemptId", String(attemptId))
      }

      const headers: Record<string, string> = {}
      if (userType === "student") {
        Object.assign(headers, getStudentAuthHeaders() as Record<string, string>)
      }
      if (userType === "instructor" && typeof window !== "undefined") {
        const iid = sessionStorage.getItem("instructorId") || localStorage.getItem("instructorId")
        if (iid) headers["x-instructor-id"] = iid
      }

      const res = await fetch(`/api/attempt-score-history?${params}`, { headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load history")
      setHistory(Array.isArray(data.history) ? data.history : [])
      setLoaded(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history")
    } finally {
      setLoading(false)
    }
  }, [attemptId, quizId, studentId, userType])

  useEffect(() => {
    if (refreshKey > 0) {
      setLoaded(false)
      setPage(1)
    }
  }, [refreshKey])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  useEffect(() => {
    if (open && !loaded && !loading) {
      void fetchHistory()
    }
  }, [open, loaded, loading, fetchHistory])

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "w-full rounded-xl",
        fr ? fr.fp.softBg : "border border-slate-200/80 dark:border-slate-600/60 bg-gradient-to-b from-slate-50/80 to-white/40 dark:from-slate-800/50 dark:to-slate-900/30",
        className,
      )}
    >
      <CollapsibleTrigger className={cn("flex w-full min-h-[3.75rem] items-center justify-between gap-4 px-5 py-4 text-left rounded-xl transition-colors", fr ? "hover:bg-orange-500/5 dark:hover:bg-orange-500/10" : "hover:bg-slate-100/60 dark:hover:bg-slate-700/30")}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", fr ? cn(fr.fp.iconBg, fr.fp.iconText) : "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]")}>
            <History className={cn("h-4 w-4", fr?.fp.iconText ?? "text-indigo-600 dark:text-indigo-400")} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-semibold text-sm sm:text-base text-slate-800 dark:text-slate-200">
              Grade change history
            </span>
            {loaded && history.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {history.length} {history.length === 1 ? "update" : "updates"} recorded
              </p>
            )}
            {!loaded && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Re-evaluation, instructor adjustments, and recalculations
              </p>
            )}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-5 pb-5">
        {loading && (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading history…
          </div>
        )}
        {error && (
          <p className="py-4 text-sm text-red-600 dark:text-red-400 rounded-lg bg-red-50/80 dark:bg-red-950/30 px-3">
            {error}
          </p>
        )}
        {!loading && !error && loaded && history.length === 0 && (
          <p className="py-4 text-sm text-slate-500 dark:text-slate-400">
            No grade changes recorded yet. Updates from re-evaluation, instructor adjustments, and
            recalculation will appear here.
          </p>
        )}
        {!loading && history.length > 0 && (
          <div className="mt-1 space-y-3">
            <div
              className={`${HISTORY_SCROLL_MAX_H} overflow-y-auto overscroll-y-contain rounded-lg border border-slate-200/60 dark:border-slate-600/40 bg-slate-50/40 dark:bg-slate-900/20 pr-1`}
              aria-label="Grade change history entries"
            >
              <ol className="relative space-y-0 p-3 pl-4">
                {paginatedHistory.map((row, index) => (
                  <HistoryEntry
                    key={row.id}
                    row={row}
                    showConnector={index < paginatedHistory.length - 1}
                  />
                ))}
              </ol>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200/70 dark:border-slate-600/50 pt-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums text-center sm:text-left">
                Showing {rangeStart}–{rangeEnd} of {history.length}
                {totalPages > 1 ? ` · Page ${safePage} of ${totalPages}` : ""}
              </p>
              {totalPages > 1 && (
                <Pagination className="mx-0 w-full sm:w-auto justify-center sm:justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setPage((p) => Math.max(1, p - 1))
                        }}
                        className={safePage <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-2 text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">
                        {safePage} / {totalPages}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setPage((p) => Math.min(totalPages, p + 1))
                        }}
                        className={safePage >= totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
