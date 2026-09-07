"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  MapPin,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { getStudentData } from "@/lib/auth"
import { formatCentralDate, formatCentralDateTime } from "@/lib/timezone"
import { formatKpiCount, formatKpiPercent } from "@/lib/dashboard-v2/format-kpi-value"
import { buildAttendanceGoalInsight } from "@/lib/attendance/student-attendance-insights"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme, studentModuleSpinnerClass } from "@/lib/student-module-themes"
import { PORTAL_CARD, PORTAL_LIST_ROW_HOVER, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { StudentAttendanceEmptyGuide } from "@/components/student/dashboard-v2/StudentAttendanceEmptyGuide"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { themeChromeFamily } from "@/lib/appearance/module-chrome"
import { contentThumbsForFamily } from "@/lib/student-color-hunt-theme"
import { inkOnFillForMode } from "@/lib/appearance/chrome-ink"
import {
  isAttendedAttendanceStatus,
  isMissedAttendanceStatus,
} from "@/lib/attendance-status"

interface AttendanceRecord {
  id: number
  classTitle: string
  startTime: string
  timestamp: string
  status: string
  geoVerified: boolean
  distanceMeters: number | null
  pointsEarned: number
}

type StatusFilter = "all" | "present" | "absent"

const PAGE_SIZE = 10

const FILTER_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "present", label: "Present" },
  { id: "absent", label: "Missed" },
]

export function StudentAttendanceHistoryV2() {
  const router = useRouter()
  const theme = getStudentModuleTheme("attendance")
  const { themeId, tokens, isDark } = useAppearance()
  const thumbs = useMemo(
    () => contentThumbsForFamily(themeChromeFamily(themeId)),
    [themeId],
  )
  const deep = tokens.accentHover || tokens.accent

  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [page, setPage] = useState(1)

  useEffect(() => {
    const student = getStudentData()
    if (!student?.databaseId) {
      router.push("/student/login")
      return
    }
    void fetchHistory(student.databaseId)
  }, [router])

  const fetchHistory = async (studentId: string) => {
    try {
      setLoading(true)
      const student = getStudentData()
      const headers: HeadersInit = {}
      if (student) {
        headers["x-student-id"] = student.databaseId
        headers["x-student-session"] = student.section
      }
      const response = await fetch(`/api/attendance/records?studentId=${studentId}`, { headers })
      if (response.status === 401) {
        router.push("/student/login")
        return
      }
      if (response.ok) {
        const data = await response.json()
        setRecords(data.records || [])
      }
    } catch (error) {
      console.error("[StudentAttendanceHistoryV2]", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredRecords = useMemo(() => {
    if (statusFilter === "all") return records
    if (statusFilter === "present") return records.filter((r) => isAttendedAttendanceStatus(r.status))
    return records.filter((r) => isMissedAttendanceStatus(r.status))
  }, [records, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const pageRecords = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filteredRecords.slice(start, start + PAGE_SIZE)
  }, [filteredRecords, safePage])

  useEffect(() => {
    setPage(1)
  }, [statusFilter])

  const attendedCount = records.filter((r) => isAttendedAttendanceStatus(r.status)).length
  const missedCount = records.filter((r) => isMissedAttendanceStatus(r.status)).length
  const missedRecent = useMemo(
    () =>
      records
        .filter((r) => isMissedAttendanceStatus(r.status))
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 2),
    [records],
  )
  const attendanceRate = records.length > 0 ? (attendedCount / records.length) * 100 : 0
  const goalInsight = buildAttendanceGoalInsight(attendedCount, records.length)

  const exportToCsv = () => {
    const headers = ["Date", "Class", "Status", "Time", "Points", "Geo Verified"]
    const rows = filteredRecords.map((r) => [
      formatCentralDate(r.startTime),
      r.classTitle,
      r.status,
      formatCentralDateTime(r.timestamp, "h:mm a z"),
      r.pointsEarned,
      r.geoVerified ? "Yes" : "No",
    ])
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `attendance-history-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div
          className={cn(
            "h-9 w-9 animate-spin rounded-full border-2 border-[var(--border)]",
            studentModuleSpinnerClass("attendance"),
          )}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {missedCount > 0 && statusFilter !== "present" ? (
        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 sm:px-5">
          <p className="text-sm font-semibold text-[var(--cc-text)]">
            {formatKpiCount(missedCount)} missed session{missedCount === 1 ? "" : "s"}
          </p>
          <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>{goalInsight.message}</p>
          {missedRecent.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {missedRecent.map((r) => (
                <li key={r.id} className="truncate text-xs text-[var(--cc-text-muted)]">
                  {formatCentralDate(r.startTime, "MMM d")} · {r.classTitle}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

    <div className={cn(PORTAL_CARD, "overflow-hidden")}>
      <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--cc-text)]">Session log</p>
          <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
            {formatKpiCount(attendedCount)} present · {formatKpiCount(missedCount)} missed ·{" "}
            {formatKpiPercent(attendanceRate)} rate
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--muted)]/35 p-0.5">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setStatusFilter(option.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  statusFilter === option.id
                    ? "bg-[var(--card)] text-[var(--cc-text)] shadow-sm"
                    : "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={filteredRecords.length === 0}
            className="size-9 shrink-0 rounded-xl text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]"
            onClick={exportToCsv}
            aria-label="Export CSV"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        statusFilter !== "all" ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-medium text-[var(--cc-text)]">No matching sessions</p>
            <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>Try another filter.</p>
          </div>
        ) : (
          <StudentAttendanceEmptyGuide variant="log" />
        )
      ) : (
        <>
          <div className="divide-y divide-[var(--border)]">
            {pageRecords.map((record, index) => {
              const attended = isAttendedAttendanceStatus(record.status)
              const missed = isMissedAttendanceStatus(record.status)
              const late = record.status === "late"
              const fill = thumbs[index % thumbs.length] ?? thumbs[0]!
              const thumb = {
                fill: attended ? fill : "color-mix(in srgb, var(--muted) 88%, var(--border))",
                icon: attended
                  ? inkOnFillForMode(fill, isDark, deep)
                  : "var(--cc-text-muted)",
              }
              const Icon = missed ? XCircle : late ? Clock : CheckCircle2

              return (
                <div
                  key={record.id}
                  className={cn(
                    "flex h-[76px] items-center gap-3 px-4 sm:px-5",
                    PORTAL_LIST_ROW_HOVER,
                  )}
                >
                  <SolidListThumbTile thumb={thumb} icon={Icon} size="compact" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--cc-text)]">
                      {record.classTitle}
                    </p>
                    <p className={cn("mt-0.5 truncate text-xs", PORTAL_TEXT_MUTED)}>
                      {formatCentralDate(record.startTime, "MMM d, yyyy")} ·{" "}
                      {formatCentralDateTime(record.timestamp, "h:mm a")}
                      {record.geoVerified ? (
                        <>
                          {" "}
                          · <MapPin className="mr-0.5 inline h-3 w-3" />
                          verified
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        attended ? theme.page.iconText : PORTAL_TEXT_MUTED,
                      )}
                    >
                      {attended ? `+${record.pointsEarned}` : "—"}
                    </p>
                    <p className={cn("text-[10px] uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                      {missed ? "missed" : late ? "late" : attended ? "pts" : record.status}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {filteredRecords.length > PAGE_SIZE ? (
            <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2.5 sm:px-5">
              <p className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filteredRecords.length)} of{" "}
                {filteredRecords.length}
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
        </>
      )}
    </div>
    </div>
  )
}
