"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  CalendarCheck,
  Flame,
  Hash,
  MapPin,
  QrCode,
  Target,
  Trophy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { StudentQRScanner } from "@/components/attendance/student-qr-scanner"
import { StudentFallbackModal } from "@/components/attendance/student-fallback-modal"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme, studentModuleSpinnerClass } from "@/lib/student-module-themes"
import { PORTAL_CARD, PORTAL_LIST_ROW_HOVER, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import {
  buildAttendanceGoalInsight,
  buildRecentWeekStrip,
  nextStreakMilestone,
  rankClimbHint,
} from "@/lib/attendance/student-attendance-insights"
import { ThemeKpiCard } from "@/components/student/dashboard-v2/ThemeKpiCard"
import { formatKpiCount, formatKpiPercent } from "@/lib/dashboard-v2/format-kpi-value"
import { solidListThumb, STUDENT_DASHBOARD_KPI_THUMBS } from "@/lib/student-color-hunt-theme"
import { formatCentralDate } from "@/lib/timezone"
import { isAttendedAttendanceStatus } from "@/lib/attendance-status"
import {
  StudentAttendanceSessionList,
  type StudentAttendanceSessionItem,
} from "@/components/attendance/student-attendance-session-list"
import { StudentAttendanceEmptyGuide } from "@/components/student/dashboard-v2/StudentAttendanceEmptyGuide"
import { StructuredSessionCheckIn } from "@/components/student/dashboard-v2/StructuredSessionCheckIn"
import {
  PortalLeaderboardPodium,
  buildPortalPodiumEntries,
  type PortalPodiumEntry,
} from "@/components/dashboard-v2/PortalLeaderboardPodium"

type AttendanceStats = {
  classesAttended: number
  totalClasses: number
  attendancePercentage: number
  pointsEarned: number
  currentStreak: number
  totalPoints: number
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
  current_streak?: number
  currentStreak?: number
  is_current_user?: boolean
}

type RecentRecord = {
  id: number
  classTitle: string
  startTime: string
  status: string
  pointsEarned: number
  geoVerified: boolean
}

export function StudentAttendanceOverviewV2() {
  const router = useRouter()
  const { toast } = useToast()
  const theme = getStudentModuleTheme("attendance")

  const [loading, setLoading] = useState(true)
  const [studentDbId, setStudentDbId] = useState<string | null>(null)
  const [studentName, setStudentName] = useState("")
  const [section, setSection] = useState("")
  const [stats, setStats] = useState<AttendanceStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [currentRank, setCurrentRank] = useState<number | null>(null)
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([])
  const [allRecords, setAllRecords] = useState<RecentRecord[]>([])
  const [showScanner, setShowScanner] = useState(false)
  const [showFallbackModal, setShowFallbackModal] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null)
  const [currentSessionLabel, setCurrentSessionLabel] = useState<string | undefined>()
  const [currentRequireLocation, setCurrentRequireLocation] = useState<boolean | undefined>()
  const [scheduledSessions, setScheduledSessions] = useState<StudentAttendanceSessionItem[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)

  const studentHeaders = useCallback((student: NonNullable<ReturnType<typeof getStudentData>>): HeadersInit => {
    return {
      "x-student-id": student.databaseId,
      "x-student-session": student.section,
    }
  }, [])

  const fetchScheduledSessions = useCallback(async () => {
    const student = getStudentData()
    if (!student?.databaseId) return
    try {
      setSessionsLoading(true)
      const res = await studentApiFetch(
        `/api/attendance/student-sessions?studentId=${encodeURIComponent(student.databaseId)}`,
      )
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        console.error("[StudentAttendanceOverviewV2] student-sessions", res.status, errBody)
        setScheduledSessions([])
        return
      }
      const data = await res.json()
      setScheduledSessions((data.sessions ?? []) as StudentAttendanceSessionItem[])
    } catch {
      setScheduledSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    const student = getStudentData()
    if (!student?.databaseId) {
      router.push("/student/login")
      return
    }

    setStudentDbId(student.databaseId)
    setStudentName(student.name)
    setSection(student.section)

    const headers = studentHeaders(student)

    try {
      setLoading(true)
      const [recordsRes, streaksRes, leaderboardRes, scoreRes] = await Promise.all([
        fetch(`/api/attendance/records?studentId=${student.databaseId}`, {
          headers,
          credentials: "include",
        }),
        fetch(`/api/attendance/streaks?studentId=${student.databaseId}`, {
          headers,
          credentials: "include",
        }),
        fetch(`/api/attendance/leaderboard?section=${encodeURIComponent(student.section)}&limit=10`, {
          headers,
          credentials: "include",
        }),
        fetch(`/api/attendance/score?studentId=${student.databaseId}`, {
          headers,
          credentials: "include",
        }),
      ])

      if ([recordsRes, streaksRes, leaderboardRes, scoreRes].some((r) => r.status === 401)) {
        router.push("/student/login")
        return
      }

      const recordsData = recordsRes.ok ? await recordsRes.json() : { records: [] }
      const streaksData = streaksRes.ok ? await streaksRes.json() : { streak: {} }
      const leaderboardData = leaderboardRes.ok ? await leaderboardRes.json() : {}
      const scoreData = scoreRes.ok ? await scoreRes.json() : {}

      const att = scoreData.attendance ?? {}
      const classesAttended = Number(att.classes_attended ?? 0)
      const totalClasses = Number(att.sessions_scored_so_far ?? att.total_classes ?? 0)

      setStats({
        classesAttended,
        totalClasses,
        attendancePercentage: Number(att.attendance_percentage ?? 0),
        pointsEarned: Number(att.total_points_earned ?? 0),
        currentStreak: Number(streaksData.streak?.currentStreak ?? 0),
        totalPoints: Number(streaksData.streak?.totalPoints ?? 0),
      })

      const board = (leaderboardData.leaderboard ?? []).map((entry: LeaderboardEntry, i: number) => ({
        ...entry,
        rank: entry.rank || i + 1,
        is_current_user:
          entry.is_current_user || String(entry.id) === student.databaseId,
      }))
      setLeaderboard(board)

      const cs = leaderboardData.currentStudent
      setCurrentRank(cs?.rank != null ? Number(cs.rank) : null)

      const records = (recordsData.records ?? []) as RecentRecord[]
      setAllRecords(records)
      setRecentRecords(
        [...records]
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
          .slice(0, 3),
      )
      void fetchScheduledSessions()
    } catch (error) {
      console.error("[StudentAttendanceOverviewV2]", error)
    } finally {
      setLoading(false)
    }
  }, [router, fetchScheduledSessions, studentHeaders])

  useEffect(() => {
    void load()
  }, [load])

  const openSessionCheckIn = useCallback((session: StudentAttendanceSessionItem, mode: "code" | "qr") => {
    if (!session.canCheckIn) return
    if (mode === "qr") {
      setShowScanner(true)
      return
    }
    setCurrentSessionId(session.id)
    setCurrentSessionLabel(session.classTitle)
    setCurrentRequireLocation(session.requireLocation)
    setShowFallbackModal(true)
  }, [])

  const selfCheckIn = useCallback(
    async (session: StudentAttendanceSessionItem) => {
      const student = getStudentData()
      if (!session.canCheckIn || !student?.databaseId) return
      try {
        const res = await studentApiFetch("/api/student/attendance/self-checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: student.databaseId, sessionId: session.id }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Check-in failed")
        toast({
          title: data.alreadyRecorded ? "Already checked in" : "Attendance recorded",
          description: data.alreadyRecorded
            ? `Status: ${data.status}`
            : `${data.sessionTitle ?? session.classTitle} · ${String(data.status)}`,
        })
        void load()
      } catch (error) {
        toast({
          title: "Check-in failed",
          description: error instanceof Error ? error.message : "Try again during the session window.",
          variant: "destructive",
        })
      }
    },
    [load, toast],
  )

  const openFirstOpenSession = useCallback(
    (mode: "code" | "qr") => {
      const openSession = scheduledSessions.find((s) => s.canCheckIn)
      if (openSession) {
        if (openSession.selfCheckInEnabled || openSession.sessionType === "STRUCTURED_COURSECOLLAB") {
          void selfCheckIn(openSession)
          return
        }
        openSessionCheckIn(openSession, mode)
        return
      }
      toast({
        title: "No open session",
        description:
          scheduledSessions.find((s) => s.checkInStatus === "upcoming")?.statusMessage ??
          "Select a structured CourseCollab session below when its window opens.",
      })
    },
    [openSessionCheckIn, scheduledSessions, selfCheckIn, toast],
  )

  const handleScanSuccess = () => {
    setShowScanner(false)
    void load()
  }

  const openCodeFallback = () => openFirstOpenSession("code")

  const goalInsight = useMemo(() => {
    if (!stats) return null
    return buildAttendanceGoalInsight(stats.classesAttended, stats.totalClasses)
  }, [stats])

  const weekStrip = useMemo(() => buildRecentWeekStrip(allRecords, 5), [allRecords])

  const streakMilestone = useMemo(
    () => (stats ? nextStreakMilestone(stats.currentStreak) : null),
    [stats],
  )

  const podiumEntries = useMemo((): PortalPodiumEntry[] => {
    if (leaderboard.length === 0) return []
    return buildPortalPodiumEntries(leaderboard.slice(0, 3), (entry, rank) => {
      const isYou =
        entry.is_current_user || (entry.id != null && String(entry.id) === studentDbId)
      const pct = Number(entry.attendance_percentage ?? entry.attendancePercentage) || 0
      const pts = Number(entry.total_points ?? entry.totalPoints) || 0
      const streak = Number(entry.current_streak ?? entry.currentStreak) || 0
      return {
        rank,
        primaryLabel: isYou
          ? `${entry.full_name || entry.studentName || studentName || "You"} (You)`
          : `Rank ${rank}`,
        secondaryLabel: isYou
          ? `${formatKpiPercent(pct)} · ${formatKpiCount(pts)} pts`
          : "Classmate (name hidden)",
        score: rank,
        scoreUnit: "",
        scoreDetail: isYou && streak > 0 ? `${streak}-day streak` : undefined,
      }
    })
  }, [leaderboard, studentDbId, studentName])

  const climbHint = useMemo(() => {
    if (!stats || currentRank == null || currentRank <= 0) return null
    return rankClimbHint(currentRank, stats.totalPoints, leaderboard)
  }, [stats, currentRank, leaderboard])

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
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
    <>
      <div className="space-y-3">
        <StructuredSessionCheckIn onRecorded={() => void load()} />

        {/* Check-in */}
        <div
          className={cn(
            PORTAL_CARD,
            "flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className={cn("shrink-0 rounded-xl p-2.5", theme.page.iconBg, theme.page.iconText)}>
              <CalendarCheck className="h-4 w-4" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--cc-text)]">Check in</p>
              <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)}>
                {stats && stats.totalClasses > 0
                  ? goalInsight?.message
                  : "Ready when your instructor opens a session"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 flex-1 rounded-xl border-[var(--border)] bg-[var(--card)] sm:flex-none"
              onClick={() => openFirstOpenSession("code")}
            >
              <Hash className="mr-1.5 h-4 w-4" />
              Code
            </Button>
            <Button
              type="button"
              className="h-9 flex-1 rounded-xl border-0 shadow-none hover:opacity-90 sm:flex-none"
              style={{ backgroundColor: "var(--cc-accent)", color: "#fff" }}
              onClick={() => openFirstOpenSession("qr")}
            >
              <QrCode className="mr-1.5 h-4 w-4" />
              Scan QR
            </Button>
          </div>
        </div>

        {stats ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <ThemeKpiCard
                label="Rate"
                value={
                  stats.totalClasses > 0
                    ? formatKpiPercent(stats.attendancePercentage)
                    : "—"
                }
                icon={Target}
                thumb={STUDENT_DASHBOARD_KPI_THUMBS.attendance}
                footer={
                  goalInsight?.met
                    ? `${goalInsight.goalPct}% goal met`
                    : goalInsight && goalInsight.sessionsNeeded > 0
                      ? `${goalInsight.sessionsNeeded} session${goalInsight.sessionsNeeded === 1 ? "" : "s"} to ${goalInsight.goalPct}%`
                      : "No scored sessions yet"
                }
              />
              <ThemeKpiCard
                label="Present"
                value={formatKpiCount(stats.classesAttended)}
                icon={CalendarCheck}
                thumb={solidListThumb(1)}
                footer={
                  stats.totalClasses > 0
                    ? `of ${formatKpiCount(stats.totalClasses)} scored`
                    : "Awaiting first session"
                }
              />
              <ThemeKpiCard
                label="Streak"
                value={`${formatKpiCount(stats.currentStreak)}d`}
                icon={Flame}
                thumb={STUDENT_DASHBOARD_KPI_THUMBS.streak}
                footer={
                  streakMilestone
                    ? `${streakMilestone.remaining}d to ${streakMilestone.target}-day badge`
                    : stats.currentStreak > 0
                      ? "Keep it going"
                      : "Start today"
                }
              />
              <ThemeKpiCard
                label="Rank"
                value={currentRank != null && currentRank > 0 ? `#${currentRank}` : "—"}
                icon={Trophy}
                thumb={solidListThumb(3)}
                footer={
                  climbHint
                    ? climbHint.length > 36
                      ? `${climbHint.slice(0, 33)}…`
                      : climbHint
                    : "Section board"
                }
              />
            </div>

            {goalInsight && !goalInsight.met && stats.totalClasses > 0 ? (
              <div className={cn(PORTAL_CARD, "px-4 py-3 sm:px-5")}>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-[var(--cc-text)]">
                    Path to {goalInsight.goalPct}%
                  </span>
                  <span className={cn("tabular-nums", PORTAL_TEXT_MUTED)}>
                    {formatKpiPercent(goalInsight.currentPct)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--cc-accent)] transition-[width] duration-500"
                    style={{ width: `${Math.min(100, goalInsight.currentPct)}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className={cn(PORTAL_CARD, "px-4 py-3 sm:px-5")}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Last 5 school days</p>
                <div className="flex items-center justify-between gap-2 sm:justify-end sm:gap-3">
                  {weekStrip.map((day) => (
                    <div key={day.label} className="flex flex-col items-center gap-1.5">
                      <span
                        className={cn(
                          "size-3 rounded-full ring-2 ring-offset-2 ring-offset-[var(--card)]",
                          day.status === "present" && "bg-emerald-500 ring-emerald-500/25",
                          day.status === "absent" && "bg-rose-400 ring-rose-400/25",
                          day.status === "none" && "bg-[var(--muted)] ring-[var(--border)]",
                        )}
                        title={day.status}
                      />
                      <span className={cn("text-[10px] font-medium tabular-nums", PORTAL_TEXT_MUTED)}>
                        {day.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}

        <StudentAttendanceSessionList
          sessions={scheduledSessions}
          loading={sessionsLoading}
          onSelfCheckIn={(session) => void selfCheckIn(session)}
          onCheckInCode={(session) => openSessionCheckIn(session, "code")}
          onCheckInQr={(session) => openSessionCheckIn(session, "qr")}
        />

        {/* Podium — not implemented before; now uses shared PortalLeaderboardPodium */}
        {podiumEntries.length > 0 ? (
          <PortalLeaderboardPodium
            entries={podiumEntries}
            heading="Section podium"
            className="border-[var(--border)]"
          />
        ) : null}

        {currentRank != null && currentRank > 0 && climbHint ? (
          <p className={cn("px-1 text-center text-xs", PORTAL_TEXT_MUTED)}>{climbHint}</p>
        ) : null}

        {/* Recent sessions */}
        <div className={cn(PORTAL_CARD, "overflow-hidden")}>
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-5">
            <div>
              <p className="text-sm font-semibold text-[var(--cc-text)]">Recent sessions</p>
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Latest check-ins</p>
            </div>
            <Link
              href="/student/dashboard-v2/attendance/history"
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--cc-accent-dark)] hover:underline"
            >
              Full log
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recentRecords.length === 0 ? (
            <StudentAttendanceEmptyGuide variant="log" />
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {recentRecords.map((record) => {
                const attended = isAttendedAttendanceStatus(record.status)
                const late = record.status === "late"
                return (
                  <div
                    key={record.id}
                    className={cn(
                      "flex h-[68px] items-center gap-3 px-4 sm:px-5",
                      PORTAL_LIST_ROW_HOVER,
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                        attended
                          ? cn(theme.page.iconBg, theme.page.iconText)
                          : "bg-[var(--muted)] text-[var(--cc-text-muted)]",
                      )}
                    >
                      {attended ? "+" : "—"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--cc-text)]">
                        {record.classTitle}
                      </p>
                      <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)}>
                        {formatCentralDate(record.startTime, "MMM d, yyyy")}
                        {record.geoVerified ? (
                          <>
                            {" "}
                            · <MapPin className="inline h-3 w-3" /> verified
                          </>
                        ) : null}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--cc-text)]">
                      {attended ? `+${record.pointsEarned}` : "missed"}
                      {late ? (
                        <span className={cn("ml-1 text-[10px] font-medium uppercase", PORTAL_TEXT_MUTED)}>
                          late
                        </span>
                      ) : null}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            href="/student/dashboard-v2/attendance/history"
            className={cn(
              PORTAL_CARD,
              "flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-[var(--muted)]/30 sm:px-5",
            )}
          >
            <span className="text-sm font-medium text-[var(--cc-text)]">Session log</span>
            <ArrowRight className="h-4 w-4 text-[var(--cc-text-muted)]" />
          </Link>
          <Link
            href="/student/dashboard-v2/attendance/analytics"
            className={cn(
              PORTAL_CARD,
              "flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-[var(--muted)]/30 sm:px-5",
            )}
          >
            <span className="text-sm font-medium text-[var(--cc-text)]">Insights & trends</span>
            <ArrowRight className="h-4 w-4 text-[var(--cc-text-muted)]" />
          </Link>
        </div>
      </div>

      {showScanner && studentDbId ? (
        <StudentQRScanner
          studentId={studentDbId}
          onClose={() => setShowScanner(false)}
          onSuccess={handleScanSuccess}
        />
      ) : null}
      {showFallbackModal && currentSessionId && studentDbId ? (
        <StudentFallbackModal
          isOpen={showFallbackModal}
          sessionId={currentSessionId}
          studentId={studentDbId}
          requireLocation={currentRequireLocation}
          sessionLabel={currentSessionLabel}
          onClose={() => {
            setShowFallbackModal(false)
            setCurrentSessionId(null)
            setCurrentSessionLabel(undefined)
            setCurrentRequireLocation(undefined)
          }}
          onSuccess={handleScanSuccess}
        />
      ) : null}
    </>
  )
}
