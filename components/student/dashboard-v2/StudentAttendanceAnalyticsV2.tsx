"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Flame, MapPin, Sparkles, Trophy } from "lucide-react"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import {
  formatKpiCount,
  formatKpiPercent,
} from "@/lib/dashboard-v2/format-kpi-value"
import {
  buildAttendanceGoalInsight,
  nextStreakMilestone,
  projectRateIfPresent,
} from "@/lib/attendance/student-attendance-insights"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme, studentModuleSpinnerClass } from "@/lib/student-module-themes"
import { PORTAL_CARD, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { StudentAttendanceEmptyGuide } from "@/components/student/dashboard-v2/StudentAttendanceEmptyGuide"
import {
  PortalLeaderboardPodium,
  buildPortalPodiumEntries,
  type PortalPodiumEntry,
} from "@/components/dashboard-v2/PortalLeaderboardPodium"

type AttendanceRecord = {
  classTitle: string
  startTime: string
  status: string
  geoVerified: boolean
  distanceMeters: number | null
}

type StreakPayload = {
  currentStreak?: number
  longestStreak?: number
  totalPoints?: number
}

type LeaderboardEntry = {
  id?: number
  rank: number
  full_name?: string
  studentName?: string
  attendance_percentage?: number
  attendancePercentage?: number
  total_points?: number
  totalPoints?: number
  is_current_user?: boolean
}

function weekLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function weekKey(iso: string): string {
  const d = new Date(iso)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().slice(0, 10)
}

export function StudentAttendanceAnalyticsV2() {
  const router = useRouter()
  const theme = getStudentModuleTheme("attendance")
  const [loading, setLoading] = useState(true)
  const [attendancePct, setAttendancePct] = useState(0)
  const [classesAttended, setClassesAttended] = useState(0)
  const [scoredSessions, setScoredSessions] = useState(0)
  const [streak, setStreak] = useState<StreakPayload>({})
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [studentDbId, setStudentDbId] = useState<string | null>(null)

  useEffect(() => {
    const student = getStudentData()
    if (!student?.databaseId) {
      router.push("/student/login")
      return
    }
    void load(student.databaseId, student.section)
  }, [router])

  const load = async (studentId: string, section: string) => {
    try {
      setLoading(true)
      setStudentDbId(studentId)
      const headers: HeadersInit = {
        "x-student-id": studentId,
        "x-student-session": section,
      }
      const [scoreRes, streakRes, recordsRes, leaderboardRes] = await Promise.all([
        studentApiFetch(`/api/attendance/score?studentId=${studentId}`),
        studentApiFetch(`/api/attendance/streaks?studentId=${studentId}`),
        fetch(`/api/attendance/records?studentId=${studentId}`, { headers }),
        fetch(`/api/attendance/leaderboard?section=${encodeURIComponent(section)}&limit=10`, {
          headers,
          credentials: "include",
        }),
      ])

      if (scoreRes.ok) {
        const data = await scoreRes.json()
        const att = data.attendance ?? {}
        setAttendancePct(Number(att.attendance_percentage ?? 0))
        setClassesAttended(Number(att.classes_attended ?? 0))
        setScoredSessions(Number(att.sessions_scored_so_far ?? att.total_classes ?? 0))
      }
      if (streakRes.ok) {
        const data = await streakRes.json()
        setStreak(data.streak ?? {})
      }
      if (recordsRes.ok) {
        const data = await recordsRes.json()
        setRecords(data.records ?? [])
      }
      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json()
        setLeaderboard(
          (data.leaderboard ?? []).map((entry: LeaderboardEntry, i: number) => ({
            ...entry,
            rank: entry.rank || i + 1,
          })),
        )
      }
    } catch (error) {
      console.error("[StudentAttendanceAnalyticsV2]", error)
    } finally {
      setLoading(false)
    }
  }

  const geoVerifiedCount = useMemo(
    () => records.filter((r) => r.geoVerified && r.status === "present").length,
    [records],
  )

  const weeklyTrend = useMemo(() => {
    const map = new Map<string, { present: number; total: number; label: string }>()
    for (const record of records) {
      const key = weekKey(record.startTime)
      const entry = map.get(key) ?? { present: 0, total: 0, label: weekLabel(key) }
      entry.total += 1
      if (record.status === "present") entry.present += 1
      map.set(key, entry)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-4)
      .map(([, stats]) => ({
        label: stats.label,
        rate: stats.total > 0 ? (stats.present / stats.total) * 100 : 0,
        present: stats.present,
        total: stats.total,
      }))
  }, [records])

  const topClasses = useMemo(() => {
    const map = new Map<string, { present: number; total: number }>()
    for (const record of records) {
      const entry = map.get(record.classTitle) ?? { present: 0, total: 0 }
      entry.total += 1
      if (record.status === "present") entry.present += 1
      map.set(record.classTitle, entry)
    }
    return [...map.entries()]
      .map(([title, stats]) => ({
        title,
        present: stats.present,
        total: stats.total,
      }))
      .sort((a, b) => b.present - a.present || b.total - a.total)
      .slice(0, 3)
  }, [records])

  const goalInsight = useMemo(
    () => buildAttendanceGoalInsight(classesAttended, scoredSessions),
    [classesAttended, scoredSessions],
  )
  const streakMilestone = useMemo(
    () => nextStreakMilestone(streak.currentStreak ?? 0),
    [streak.currentStreak],
  )
  const ifNextPresent = projectRateIfPresent(classesAttended, scoredSessions, 1)
  const ifNextTwo = projectRateIfPresent(classesAttended, scoredSessions, 2)

  const hasData = records.length > 0
  const isFreshStart = !hasData && scoredSessions === 0 && classesAttended === 0

  const podiumEntries = useMemo((): PortalPodiumEntry[] => {
    if (leaderboard.length === 0) return []
    return buildPortalPodiumEntries(leaderboard.slice(0, 3), (entry, rank) => {
      const isYou =
        entry.is_current_user || (entry.id != null && String(entry.id) === studentDbId)
      const pct = Number(entry.attendance_percentage ?? entry.attendancePercentage) || 0
      const pts = Number(entry.total_points ?? entry.totalPoints) || 0
      return {
        rank,
        primaryLabel: isYou ? "You" : `Rank ${rank}`,
        secondaryLabel: isYou
          ? `${formatKpiPercent(pct)} · ${formatKpiCount(pts)} pts`
          : "Classmate",
        score: rank,
        scoreUnit: "",
      }
    })
  }, [leaderboard, studentDbId])

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
      <div className={cn(PORTAL_CARD, "overflow-hidden")}>
        <div
          className={cn(
            "border-b border-[var(--border)] px-5 py-6 sm:px-6",
            isFreshStart ? "bg-[var(--cc-accent-soft)]/25" : "bg-[var(--muted)]/20",
          )}
        >
          <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", PORTAL_TEXT_MUTED)}>
            {isFreshStart ? "Insights" : "Attendance rate"}
          </p>
          {isFreshStart ? (
            <>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-[var(--cc-text)] sm:text-[1.75rem]">
                Your story starts at your first check-in
              </p>
              <p className={cn("mt-2 max-w-lg text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
                {goalInsight.message} Trends, streak badges, and what-if projections appear here
                after you scan in during class.
              </p>
              <Link
                href="/student/dashboard-v2/attendance"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--cc-accent-dark)] hover:underline"
              >
                Open check-in on Home
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <>
              <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-[var(--cc-text)] sm:text-[2.75rem]">
                {formatKpiPercent(attendancePct)}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--cc-text-muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <Flame className={cn("h-3.5 w-3.5", theme.page.iconText)} />
                  {formatKpiCount(streak.currentStreak ?? 0)}-day streak
                  {(streak.longestStreak ?? 0) > 0 ? (
                    <span className="opacity-70">(best {formatKpiCount(streak.longestStreak ?? 0)})</span>
                  ) : null}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className={cn("h-3.5 w-3.5", theme.page.iconText)} />
                  {formatKpiCount(streak.totalPoints ?? 0)} pts earned
                </span>
                {geoVerifiedCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className={cn("h-3.5 w-3.5", theme.page.iconText)} />
                    {formatKpiCount(geoVerifiedCount)} location verified
                  </span>
                ) : null}
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
                <div
                  className="h-full rounded-full bg-[var(--cc-accent)] transition-all duration-500"
                  style={{ width: `${Math.min(100, attendancePct)}%` }}
                />
              </div>
            </>
          )}
        </div>

        {!isFreshStart && !goalInsight.met && scoredSessions > 0 ? (
          <div className="border-b border-[var(--border)] px-5 py-3 sm:px-6">
            <p className={cn("text-xs font-medium text-[var(--cc-text)]", PORTAL_TEXT_MUTED)}>
              What-if
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--muted)]/50 px-3 py-1 text-xs text-[var(--cc-text)]">
                Next class → {formatKpiPercent(ifNextPresent)}
              </span>
              <span className="rounded-full bg-[var(--muted)]/50 px-3 py-1 text-xs text-[var(--cc-text)]">
                Next 2 → {formatKpiPercent(ifNextTwo)}
              </span>
              {streakMilestone ? (
                <span className="rounded-full bg-[var(--cc-accent-soft)] px-3 py-1 text-xs text-[var(--cc-text)]">
                  {streakMilestone.remaining}d to {streakMilestone.target}-day badge
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {isFreshStart ? (
          <StudentAttendanceEmptyGuide variant="insights" />
        ) : !hasData ? (
          <div className="px-5 py-8 sm:px-6">
            <div className="flex items-start gap-3 rounded-xl bg-[var(--muted)]/25 px-4 py-3">
              <Sparkles className={cn("mt-0.5 h-4 w-4 shrink-0", theme.page.iconText)} />
              <div>
                <p className="text-sm font-medium text-[var(--cc-text)]">Almost there</p>
                <p className={cn("mt-0.5 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
                  {goalInsight.message} Your weekly charts will populate as sessions are scored.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid divide-y divide-[var(--border)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <section className="px-5 py-4 sm:px-6">
              <h3 className="text-sm font-semibold text-[var(--cc-text)]">Recent weeks</h3>
              <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>Last {weeklyTrend.length} weeks</p>
              {weeklyTrend.length === 0 ? (
                <p className={cn("mt-6 text-xs", PORTAL_TEXT_MUTED)}>Not enough history yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {weeklyTrend.map((week) => (
                    <li key={week.label} className="flex items-center gap-3">
                      <span className="w-14 shrink-0 text-xs tabular-nums text-[var(--cc-text-muted)]">
                        {week.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
                          <div
                            className="h-full rounded-full bg-[var(--cc-accent)]"
                            style={{ width: `${Math.min(100, week.rate)}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-16 shrink-0 text-right text-xs font-medium tabular-nums text-[var(--cc-text)]">
                        {week.present}/{week.total}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="px-5 py-4 sm:px-6">
              <h3 className="text-sm font-semibold text-[var(--cc-text)]">Most attended</h3>
              <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>Top sessions this term</p>
              {topClasses.length === 0 ? (
                <p className={cn("mt-6 text-xs", PORTAL_TEXT_MUTED)}>No class breakdown yet.</p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {topClasses.map((row, index) => (
                    <li
                      key={row.title}
                      className="flex items-center gap-3 rounded-xl bg-[var(--muted)]/25 px-3 py-2.5"
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                          theme.page.iconBg,
                          theme.page.iconText,
                        )}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--cc-text)]">{row.title}</p>
                        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                          {formatKpiCount(row.present)} of {formatKpiCount(row.total)} sessions
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--cc-text)]">
                        {formatKpiPercent(row.total > 0 ? (row.present / row.total) * 100 : 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>

      {isFreshStart && podiumEntries.length > 0 ? (
        <>
          <PortalLeaderboardPodium
            entries={podiumEntries}
            heading="Section leaders so far"
            className="border-[var(--border)]"
          />
          <p className={cn("px-1 text-center text-xs", PORTAL_TEXT_MUTED)}>
            Check in during class to join the board.
          </p>
        </>
      ) : null}

      {geoVerifiedCount > 0 ? (
        <p className={cn("px-1 text-center text-[11px]", PORTAL_TEXT_MUTED)}>
          Location checks help confirm on-campus check-ins.
        </p>
      ) : null}
    </div>
  )
}
