"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from "recharts"
import { formatCentralDate } from "@/lib/timezone"
import { useToast } from "@/hooks/use-toast"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { uniqueSessionCodes } from "@/lib/unique-session-codes"
import { attendanceStatusLabel } from "@/lib/attendance-status"
import { cn } from "@/lib/utils"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { ATTENDANCE_INPUT, ATTENDANCE_TABLE_HEAD, ATTENDANCE_TABLE_ROW } from "@/lib/attendance/attendance-surface-classes"
import {
  FacultyAttendancePanel,
  FacultyAttendanceLoading,
} from "@/components/attendance/faculty-attendance-ui"

interface InstructorAttendanceAnalyticsProps {
  instructorId: string
}

const CHART_TOOLTIP = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--cc-text)",
  fontSize: 12,
}

function pct(value: unknown): string {
  const n = Number(value)
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "0%"
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

type SortKey = "name" | "credit" | "absent" | "late"

export function InstructorAttendanceAnalytics({ instructorId }: InstructorAttendanceAnalyticsProps) {
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sectionFilter, setSectionFilter] = useState("all")
  const [availableSessions, setAvailableSessions] = useState<{ code: string }[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>("credit")
  const [sortAsc, setSortAsc] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    void fetchAnalytics()
    void fetchAvailableSessions()
  }, [instructorId, sectionFilter, courseScopeVersion])

  const fetchAvailableSessions = async () => {
    try {
      setLoadingSessions(true)
      const response = await instructorApiFetch("/api/instructor/sessions", {
        headers: buildInstructorApiHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        setAvailableSessions(uniqueSessionCodes(data.sessions || []))
      }
    } catch {
      // ignore
    } finally {
      setLoadingSessions(false)
    }
  }

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const hdrs = buildInstructorApiHeaders()
      const cid = hdrs["x-course-id"]
      const params = new URLSearchParams()
      if (sectionFilter === "all") {
        params.set("instructorId", instructorId)
        if (cid) params.set("courseId", cid)
      } else {
        params.set("section", sectionFilter)
      }
      const response = await fetch(`/api/attendance/analytics?${params}`, { headers: hdrs })
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data.analytics)
      } else {
        throw new Error("Failed to load")
      }
    } catch {
      toast({
        title: "Could not load analytics",
        description: "Try refreshing or pick a different section.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const overall = analytics?.overall ?? {}
  const summaries: any[] = analytics?.studentSummaries ?? []

  const avgCredit = summaries.length
    ? summaries.reduce((s, r) => s + num(r.attendance_percentage), 0) / summaries.length
    : num(overall.average_attendance_rate)

  const weeklyData = useMemo(
    () =>
      (analytics?.weeklyTrend ?? []).map((week: any) => ({
        week: week.week ? formatCentralDate(week.week, "MMM d") : "—",
        rate: num(week.attendance_rate),
        checkIns: num(week.check_ins),
        sessions: num(week.sessions),
      })),
    [analytics?.weeklyTrend],
  )

  const statusData = useMemo(
    () =>
      (analytics?.statusBreakdown ?? []).map((row: any) => ({
        name: attendanceStatusLabel(String(row.status)),
        value: num(row.count),
        status: String(row.status),
      })),
    [analytics?.statusBreakdown],
  )

  const statusTotals = useMemo(() => {
    const t = { present: 0, late: 0, excused: 0, absent: 0 }
    for (const row of statusData) {
      const key = row.status as keyof typeof t
      if (key in t) t[key] = row.value
    }
    return t
  }, [statusData])

  const sortedStudents = useMemo(() => {
    const rows = [...summaries]
    rows.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case "name":
          cmp = String(a.full_name).localeCompare(String(b.full_name))
          break
        case "credit":
          cmp = num(a.attendance_percentage) - num(b.attendance_percentage)
          break
        case "absent":
          cmp = num(a.absent_count) - num(b.absent_count)
          break
        case "late":
          cmp = num(a.late_count) - num(b.late_count)
          break
      }
      return sortAsc ? cmp : -cmp
    })
    return rows
  }, [summaries, sortKey, sortAsc])

  const visibleStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return sortedStudents
    return sortedStudents.filter((student) => {
      const name = String(student.full_name ?? "").toLowerCase()
      const id = String(student.student_id ?? "").toLowerCase()
      return name.includes(q) || id.includes(q)
    })
  }, [sortedStudents, searchQuery])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v)
    else {
      setSortKey(key)
      setSortAsc(key === "name")
    }
  }

  if (loading) return <FacultyAttendanceLoading />

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex shrink-0 items-center gap-2 text-xs font-semibold tabular-nums">
          <span className={cn("rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5", PORTAL_TEXT)}>
            <span className={cn("font-medium", PORTAL_TEXT_MUTED)}>Avg </span>{pct(avgCredit)}
          </span>
          <span className="rounded-lg bg-[var(--cc-sem-success)]/10 px-2 py-1.5 text-[var(--cc-sem-success)]">P {statusTotals.present}</span>
          <span className="rounded-lg bg-[var(--cc-sem-warning)]/10 px-2 py-1.5 text-[var(--cc-sem-warning)]">L {statusTotals.late}</span>
          <span className="rounded-lg bg-muted px-2 py-1.5 text-[var(--cc-text)]">E {statusTotals.excused}</span>
          <span className="rounded-lg bg-[var(--cc-sem-danger)]/10 px-2 py-1.5 text-[var(--cc-sem-danger)]">A {statusTotals.absent}</span>
        </div>
        <div className="relative min-w-[10rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students…"
            className={cn("h-9 pl-9", ATTENDANCE_INPUT)}
          />
        </div>
        <Select value={sectionFilter} onValueChange={setSectionFilter} disabled={loadingSessions}>
          <SelectTrigger className={cn("h-9 w-[9.5rem] shrink-0", ATTENDANCE_INPUT)}>
            <SelectValue placeholder={loadingSessions ? "Loading…" : "Section"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {availableSessions.map((session) => (
              <SelectItem key={session.code} value={session.code}>
                {session.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {weeklyData.length > 0 ? (
        <FacultyAttendancePanel title="Weekly trend">
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={[...weeklyData].reverse()}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "var(--cc-text-muted)" }} />
              <YAxis yAxisId="rate" tick={{ fontSize: 11, fill: "var(--cc-text-muted)" }} unit="%" width={36} />
              <Tooltip contentStyle={CHART_TOOLTIP} />
              <Area
                yAxisId="rate"
                type="monotone"
                dataKey="rate"
                stroke="var(--cc-accent)"
                strokeWidth={2}
                fill="var(--cc-accent-soft)"
                fillOpacity={0.4}
                name="Rate %"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </FacultyAttendancePanel>
      ) : null}

      <FacultyAttendancePanel
        title="Student breakdown"
        action={
          <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>{visibleStudents.length} students</span>
        }
      >
        {visibleStudents.length > 0 ? (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className={cn(ATTENDANCE_TABLE_HEAD, "text-left")}>
                  <th className={cn("px-3 py-2 font-medium cursor-pointer hover:text-[var(--cc-text)]", PORTAL_TEXT_MUTED)} onClick={() => toggleSort("name")}>
                    Student {sortKey === "name" ? (sortAsc ? "↑" : "↓") : ""}
                  </th>
                  <th className={cn("px-2 py-2 font-medium text-center", PORTAL_TEXT_MUTED)}>P</th>
                  <th className={cn("px-2 py-2 font-medium text-center", PORTAL_TEXT_MUTED)}>L</th>
                  <th className={cn("px-2 py-2 font-medium text-center", PORTAL_TEXT_MUTED)}>E</th>
                  <th className={cn("px-2 py-2 font-medium text-center cursor-pointer hover:text-[var(--cc-text)]", PORTAL_TEXT_MUTED)} onClick={() => toggleSort("absent")}>
                    A {sortKey === "absent" ? (sortAsc ? "↑" : "↓") : ""}
                  </th>
                  <th className={cn("px-3 py-2 font-medium text-right cursor-pointer hover:text-[var(--cc-text)]", PORTAL_TEXT_MUTED)} onClick={() => toggleSort("credit")}>
                    Credit {sortKey === "credit" ? (sortAsc ? "↑" : "↓") : ""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map((student) => {
                  const credit = num(student.attendance_percentage)
                  const tone =
                    credit >= 90 ? "text-[var(--cc-sem-success)]" :
                    credit >= 70 ? PORTAL_TEXT :
                    credit > 0 ? "text-[var(--cc-sem-warning)]" :
                    "text-[var(--cc-sem-danger)]"
                  return (
                    <tr
                      key={student.id}
                      className={ATTENDANCE_TABLE_ROW}
                    >
                      <td className="px-3 py-2.5">
                        <p className={cn("truncate font-medium max-w-[200px] sm:max-w-none", PORTAL_TEXT)}>
                          {student.full_name}
                        </p>
                        <p className={cn("font-mono text-xs", PORTAL_TEXT_MUTED)}>{student.student_id}</p>
                      </td>
                      <td className="py-2.5 px-2 text-center tabular-nums text-emerald-600 dark:text-emerald-400">
                        {num(student.present_count)}
                      </td>
                      <td className="py-2.5 px-2 text-center tabular-nums text-amber-600 dark:text-amber-400">
                        {num(student.late_count)}
                      </td>
                      <td className="py-2.5 px-2 text-center tabular-nums text-indigo-600 dark:text-indigo-400">
                        {num(student.excused_count)}
                      </td>
                      <td className="py-2.5 px-2 text-center tabular-nums text-red-600 dark:text-red-400">
                        {num(student.absent_count)}
                      </td>
                      <td className={cn("py-2.5 pl-3 text-right font-semibold tabular-nums", tone)}>
                        {pct(student.attendance_percentage)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={cn("py-8 text-center text-sm", PORTAL_TEXT_MUTED)}>No students in this section.</p>
        )}
      </FacultyAttendancePanel>
    </div>
  )
}
