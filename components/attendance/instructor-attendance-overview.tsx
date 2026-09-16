"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Calendar, TrendingUp, Users, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import {
  FacultyAttendancePanel,
  FacultyAttendanceLoading,
  FacultyAttendanceInsightList,
  FacultyAttendanceInsightRow,
} from "@/components/attendance/faculty-attendance-ui"

type OverviewTab = "overview" | "configure" | "qr-code" | "analytics" | "management"

interface InstructorAttendanceOverviewProps {
  instructorId: string
  embedInDashboard?: boolean
  onNavigate?: (tab: OverviewTab) => void
}

const chrome = facultyEmbedChrome("attendance")

function pct(value: unknown): string {
  const n = Number(value)
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "0%"
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function InstructorAttendanceOverview({
  instructorId,
  onNavigate,
}: InstructorAttendanceOverviewProps) {
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const headers = buildInstructorApiHeaders()
      const cid = headers["x-course-id"]
      const params = new URLSearchParams({ instructorId: String(instructorId) })
      if (cid) params.set("courseId", cid)
      const response = await fetch(`/api/attendance/analytics?${params}`, { headers })
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data.analytics)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [instructorId, courseScopeVersion])

  useEffect(() => {
    if (instructorId) void fetchData()
  }, [instructorId, fetchData])

  const followUps = useMemo(() => {
    const seen = new Set<number>()
    const rows: {
      id: number
      name: string
      meta: string
      badge: string
      badgeTone: "bad" | "warn" | "info"
    }[] = []

    const push = (row: typeof rows[number]) => {
      if (seen.has(row.id)) return
      seen.add(row.id)
      rows.push(row)
    }

    for (const student of analytics?.chronicAbsentees ?? []) {
      push({
        id: student.id,
        name: student.full_name,
        meta: `${student.student_id} · ${pct(student.attendance_percentage)} credit`,
        badge: `${student.absent_count} absent`,
        badgeTone: "bad",
      })
    }
    for (const student of analytics?.flaggedStudents ?? []) {
      push({
        id: student.id,
        name: student.full_name,
        meta: student.student_id,
        badge: pct(student.attendance_percentage),
        badgeTone: "warn",
      })
    }
    for (const student of analytics?.excusedStudents ?? []) {
      push({
        id: student.id,
        name: student.full_name,
        meta: `${student.student_id} · ${pct(student.attendance_percentage)} overall`,
        badge: `${student.excused_count} excused`,
        badgeTone: "info",
      })
    }
    return rows.slice(0, 8)
  }, [analytics])

  if (loading) return <FacultyAttendanceLoading />

  const overall = analytics?.overall ?? {}
  const enrolled = num(analytics?.studentSummaries?.length)
  const avgRate = analytics?.studentSummaries?.length
    ? analytics.studentSummaries.reduce(
        (sum: number, s: { attendance_percentage: number }) => sum + num(s.attendance_percentage),
        0,
      ) / analytics.studentSummaries.length
    : num(overall.average_attendance_rate)

  const stats = [
    { label: "Meetings", value: String(num(overall.total_sessions)), icon: Calendar },
    { label: "Avg credit", value: pct(avgRate), icon: TrendingUp },
    { label: "Roster", value: String(enrolled), icon: Users },
  ]

  return (
    <div className="space-y-3">
      <div className={cn(chrome.card, "flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4")}>
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
          {stats.map((stat, index) => {
            const stripe = portalListStripe(index, chrome.theme.family)
            const Icon = stat.icon
            return (
              <div key={stat.label} className="flex min-w-0 items-center gap-2.5">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
                  <Icon className={cn("h-4 w-4", stripe.iconText)} />
                </span>
                <div className="min-w-0">
                  <p className={cn("truncate text-[11px] font-medium", PORTAL_TEXT_MUTED)}>{stat.label}</p>
                  <p className={cn("truncate text-sm font-semibold tabular-nums", PORTAL_TEXT)}>{stat.value}</p>
                </div>
              </div>
            )
          })}
        </div>
        {onNavigate ? (
          <Button type="button" className={cn("h-9 shrink-0", chrome.solid)} onClick={() => onNavigate("management")}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Mark roll
          </Button>
        ) : null}
      </div>

      <FacultyAttendancePanel title="Needs follow-up">
        <FacultyAttendanceInsightList emptyMessage="No students need follow-up right now.">
          {followUps.map((row, index) => (
            <FacultyAttendanceInsightRow
              key={row.id}
              index={index}
              name={row.name}
              meta={row.meta}
              badge={row.badge}
              badgeTone={row.badgeTone}
            />
          ))}
        </FacultyAttendanceInsightList>
      </FacultyAttendancePanel>
    </div>
  )
}
