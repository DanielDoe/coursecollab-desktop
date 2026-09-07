"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarCheck, ChevronLeft, ChevronRight, Hash, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  formatMeetingDayLabel,
  formatMeetingTimeRange,
  type AttendanceMeetingOption,
} from "@/lib/attendance-meeting-options"
import { formatCentralDate } from "@/lib/timezone"
import { PORTAL_CARD, PORTAL_LIST_ROW_HOVER, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import type { StudentCheckInStatus } from "@/lib/attendance/student-check-in-eligibility"
import { attendanceStatusLabel, isAttendedAttendanceStatus } from "@/lib/attendance-status"

const PAGE_SIZE = 8

export type StudentAttendanceSessionItem = {
  id: number
  classTitle: string
  startTime: string
  endTime: string
  sessionType?: string | null
  selfCheckInEnabled?: boolean
  requireLocation: boolean
  checkInStatus: StudentCheckInStatus
  canCheckIn: boolean
  statusMessage: string
  record: { status: string | null; pointsEarned: number } | null
}

function statusBadge(status: StudentCheckInStatus, recordStatus?: string | null) {
  if (status === "checked_in") {
    const rs = String(recordStatus ?? "present")
    if (rs === "late") {
      return {
        label: "Late",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      }
    }
    if (rs === "excused") {
      return {
        label: "Excused",
        className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      }
    }
    return {
      label: "Present",
      className: "border-[var(--cc-accent)]/30 bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]",
    }
  }
  switch (status) {
    case "open":
      return { label: "Open", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" }
    case "upcoming":
      return { label: "Upcoming", className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300" }
    case "cancelled":
      return { label: "Cancelled", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" }
    default:
      return { label: "Closed", className: "border-[var(--border)] bg-muted text-[var(--cc-text-muted)]" }
  }
}

type Props = {
  sessions: StudentAttendanceSessionItem[]
  loading?: boolean
  onSelfCheckIn: (session: StudentAttendanceSessionItem) => void
  onCheckInCode?: (session: StudentAttendanceSessionItem) => void
  onCheckInQr?: (session: StudentAttendanceSessionItem) => void
}

function groupPageSessionsByMonth(sessions: StudentAttendanceSessionItem[]) {
  const groups: { month: string; items: StudentAttendanceSessionItem[] }[] = []
  for (const session of sessions) {
    const month = session.startTime
      ? formatCentralDate(session.startTime, "MMMM yyyy")
      : "Unscheduled"
    const last = groups[groups.length - 1]
    if (last?.month === month) {
      last.items.push(session)
    } else {
      groups.push({ month, items: [session] })
    }
  }
  return groups
}

export function StudentAttendanceSessionList({
  sessions,
  loading = false,
  onSelfCheckIn,
  onCheckInCode,
  onCheckInQr,
}: Props) {
  const [page, setPage] = useState(1)
  const initialPageSet = useRef(false)

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      ),
    [sessions],
  )

  const sessionFingerprint = useMemo(
    () => sortedSessions.map((s) => `${s.id}:${s.checkInStatus}`).join("|"),
    [sortedSessions],
  )

  useEffect(() => {
    initialPageSet.current = false
  }, [sessionFingerprint])

  useEffect(() => {
    if (loading || sortedSessions.length === 0 || initialPageSet.current) return
    initialPageSet.current = true
    const nextIdx = sortedSessions.findIndex(
      (s) => s.checkInStatus === "open" || s.checkInStatus === "upcoming",
    )
    const targetIdx = nextIdx >= 0 ? nextIdx : 0
    setPage(Math.floor(targetIdx / PAGE_SIZE) + 1)
  }, [loading, sortedSessions, sessionFingerprint])

  const totalPages = Math.max(1, Math.ceil(sortedSessions.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const pageSessions = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return sortedSessions.slice(start, start + PAGE_SIZE)
  }, [sortedSessions, safePage])

  const pageGroups = useMemo(() => groupPageSessionsByMonth(pageSessions), [pageSessions])

  if (loading) {
    return (
      <div className={cn(PORTAL_CARD, "flex min-h-[160px] items-center justify-center px-4 py-8")}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--cc-accent)]" />
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className={cn(PORTAL_CARD, "px-4 py-8 text-center sm:px-5")}>
        <CalendarCheck className="mx-auto h-8 w-8 text-[var(--cc-text-muted)]" />
        <p className="mt-2 text-sm font-medium text-[var(--cc-text)]">No sessions scheduled yet</p>
        <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
          Your instructor&apos;s class meetings will appear here when they are set up.
        </p>
      </div>
    )
  }

  return (
    <div id="student-check-in-sessions" className={cn(PORTAL_CARD, "overflow-hidden scroll-mt-4")}>
      <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <p className="text-sm font-semibold text-[var(--cc-text)]">Class sessions</p>
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          {sortedSessions.length} scheduled · select a session during its window to check in
        </p>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {pageGroups.map((group) => (
          <div key={`${group.month}-${safePage}`}>
            <p className={cn("px-4 py-2 text-[11px] font-semibold uppercase tracking-wide sm:px-5", PORTAL_TEXT_MUTED)}>
              {group.month}
            </p>
            <div className="divide-y divide-[var(--border)]">
              {group.items.map((session) => {
                const meeting: AttendanceMeetingOption = {
                  id: session.id,
                  section: "",
                  class_title: session.classTitle,
                  start_time: session.startTime,
                  end_time: session.endTime,
                }
                const badge = statusBadge(session.checkInStatus, session.record?.status)
                const timeRange = formatMeetingTimeRange(meeting)
                const isStructured =
                  session.sessionType === "STRUCTURED_COURSECOLLAB" || session.selfCheckInEnabled === true
                const checkedIn = session.checkInStatus === "checked_in"
                const recordScored =
                  session.record != null && isAttendedAttendanceStatus(String(session.record.status ?? ""))
                return (
                  <div
                    key={session.id}
                    className={cn(
                      "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5",
                      PORTAL_LIST_ROW_HOVER,
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--cc-text)]">
                          {formatMeetingDayLabel(meeting)}
                        </p>
                        <Badge variant="outline" className={cn("h-5 text-[10px] font-semibold", badge.className)}>
                          {badge.label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-[var(--cc-text)]">{session.classTitle}</p>
                      <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
                        {timeRange ?? session.statusMessage}
                        {recordScored
                          ? ` · +${session.record?.pointsEarned ?? 0} pts`
                          : session.checkInStatus !== "open"
                            ? ` · ${session.statusMessage}`
                            : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {isStructured ? (
                        checkedIn ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-9 rounded-xl border-[var(--cc-accent)]/30 bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                            disabled
                          >
                            <CalendarCheck className="mr-1.5 h-3.5 w-3.5" />
                            {attendanceStatusLabel(String(session.record?.status ?? "present"))}
                          </Button>
                        ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 rounded-xl border-0 shadow-none hover:opacity-90"
                          style={{ backgroundColor: "var(--cc-accent)", color: "#fff" }}
                          disabled={!session.canCheckIn}
                          onClick={() => onSelfCheckIn(session)}
                        >
                          <CalendarCheck className="mr-1.5 h-3.5 w-3.5" />
                          Check in
                        </Button>
                        )
                      ) : (
                        <>
                          {onCheckInCode ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-xl"
                              disabled={!session.canCheckIn}
                              onClick={() => onCheckInCode(session)}
                            >
                              <Hash className="mr-1.5 h-3.5 w-3.5" />
                              Code
                            </Button>
                          ) : null}
                          {onCheckInQr ? (
                            <Button
                              type="button"
                              size="sm"
                              className="h-9 rounded-xl border-0 shadow-none hover:opacity-90"
                              style={{ backgroundColor: "var(--cc-accent)", color: "#fff" }}
                              disabled={!session.canCheckIn}
                              onClick={() => onCheckInQr(session)}
                            >
                              <QrCode className="mr-1.5 h-3.5 w-3.5" />
                              Scan QR
                            </Button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {sortedSessions.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2.5 sm:px-5">
          <p className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sortedSessions.length)} of{" "}
            {sortedSessions.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className={cn("min-w-[4.5rem] text-center text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
              {safePage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
