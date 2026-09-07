"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  QrCode,
  Trophy,
  TrendingUp,
  Calendar,
  Award,
  Flame,
  Star,
  ArrowRight,
  History,
  Hash,
} from "lucide-react"
import { motion } from "framer-motion"
import { getStudentData } from "@/lib/auth"
import { StudentQRScanner } from "@/components/attendance/student-qr-scanner"
import { StudentFallbackModal } from "@/components/attendance/student-fallback-modal"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme, studentModuleSpinnerClass } from "@/lib/student-module-themes"
import { portalOutlineButtonClass } from "@/lib/portal-module-themes"
import {
  PORTAL_CARD,
  PORTAL_CTA,
  PORTAL_OUTLINE_BTN,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/appearance/portal-nav-classes"

interface AttendanceStats {
  classesAttended: number
  totalClasses: number
  attendancePercentage: number
  pointsEarned: number
  sessionsScheduledTotal: number
  currentStreak: number
  totalPoints: number
}

interface LeaderboardEntry {
  id?: number
  rank: number
  studentName?: string
  full_name?: string
  attendancePercentage?: number
  attendance_percentage?: number
  totalPoints?: number
  total_points?: number
  currentStreak?: number
  current_streak?: number
  is_current_user?: boolean
}

interface CurrentStudentRank {
  rank: number
  studentName: string
  attendancePercentage: number
  totalPoints: number
  currentStreak: number
  isInTopList: boolean
}

interface StudentAttendanceContentProps {
  embedInDashboard?: boolean
}

export function StudentAttendanceContent({ embedInDashboard = false }: StudentAttendanceContentProps) {
  const theme = getStudentModuleTheme("attendance")
  const pageTheme = theme.page
  const iconWellSm = cn("p-1.5 rounded-lg border shrink-0", pageTheme.iconBg, pageTheme.border)
  const iconWell = cn("p-2 rounded-xl border shrink-0", pageTheme.iconBg, pageTheme.border)
  const iconWellLg = cn("p-3 rounded-2xl border shrink-0", pageTheme.iconBg, pageTheme.border)
  const iconAccent = pageTheme.iconText
  const statCard = cn(
    "rounded-xl border p-3 shadow-sm hover:shadow-md hover:border-[var(--cc-accent-border)] transition-all duration-200",
    PORTAL_CARD,
  )
  const router = useRouter()
  const { toast } = useToast()
  const [studentData, setStudentData] = useState<{ databaseId: string; section: string; name: string } | null>(null)
  const [stats, setStats] = useState<AttendanceStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [currentStudentRank, setCurrentStudentRank] = useState<CurrentStudentRank | null>(null)
  const [loading, setLoading] = useState(true)
  const [showScanner, setShowScanner] = useState(false)
  const [showFallbackModal, setShowFallbackModal] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null)

  useEffect(() => {
    const student = getStudentData()
    if (!student) {
      router.push("/student/login")
      return
    }
    setStudentData({ databaseId: student.databaseId, section: student.section, name: student.name })
    fetchAttendanceData(student.databaseId, student.section)
  }, [router])

  const fetchAttendanceData = async (studentId: string, section: string) => {
    try {
      setLoading(true)
      const student = getStudentData()
      const headers: HeadersInit = {}
      if (student) {
        headers["x-student-id"] = student.databaseId
        headers["x-student-session"] = student.section
      }

      let recordsRes: Response | null = null
      let streaksRes: Response | null = null
      let leaderboardRes: Response | null = null
      let retries = 3

      while (retries > 0) {
        try {
          const [r1, r2, r3] = await Promise.all([
            fetch(`/api/attendance/records?studentId=${studentId}`, { headers, cache: "no-store", credentials: "include" }),
            fetch(`/api/attendance/streaks?studentId=${studentId}`, { headers, cache: "no-store", credentials: "include" }),
            fetch(`/api/attendance/leaderboard?section=${section}&limit=10`, { headers, cache: "no-store", credentials: "include" }),
          ])
          recordsRes = r1
          streaksRes = r2
          leaderboardRes = r3
          if (r1.status !== 500 && r2.status !== 500 && r3.status !== 500) break
        } catch (err) {
          retries--
          if (retries === 0) throw err
          await new Promise((r) => setTimeout(r, 1000))
        }
        retries--
        if (retries > 0) await new Promise((r) => setTimeout(r, 1000))
      }

      if (
        recordsRes &&
        streaksRes &&
        leaderboardRes &&
        (recordsRes.status === 401 || streaksRes.status === 401 || leaderboardRes.status === 401) &&
        typeof window !== "undefined"
      ) {
        router.push("/student/login")
        return
      }

      if (recordsRes?.ok && streaksRes?.ok) {
        const recordsData = await recordsRes.json()
        const streaksData = await streaksRes.json()
        const leaderboardData = leaderboardRes?.ok ? await leaderboardRes.json() : null

        const scoreRes = await fetch(`/api/attendance/score?studentId=${studentId}`, { headers, credentials: "include" })
        let totalClasses = 0
        let attendancePercentage = 0
        let pointsEarned = 0
        let sessionsScheduledTotal = 0
        let classesAttended = recordsData.records?.length || 0
        if (scoreRes.ok) {
          const scoreData = await scoreRes.json()
          const att = scoreData.attendance
          totalClasses = att?.sessions_scored_so_far ?? att?.total_classes ?? 0
          classesAttended = att?.classes_attended ?? classesAttended
          attendancePercentage = Number(att?.attendance_percentage ?? 0)
          pointsEarned = Number(att?.total_points_earned ?? 0)
          sessionsScheduledTotal = Number(att?.sessions_scheduled_total ?? 0)
        } else {
          totalClasses = classesAttended
          attendancePercentage = totalClasses > 0 ? (classesAttended / totalClasses) * 100 : 0
        }

        setStats({
          classesAttended,
          totalClasses,
          attendancePercentage,
          pointsEarned,
          sessionsScheduledTotal,
          currentStreak: streaksData.streak?.currentStreak || 0,
          totalPoints: streaksData.streak?.totalPoints || 0,
        })

        const processedLeaderboard = (leaderboardData?.leaderboard || []).map((entry: any) => ({
          id: entry.id,
          rank: entry.rank || 0,
          studentName: entry.full_name || entry.studentName,
          full_name: entry.full_name || entry.studentName,
          attendancePercentage: Number(entry.attendance_percentage ?? entry.attendancePercentage) || 0,
          attendance_percentage: Number(entry.attendance_percentage ?? entry.attendancePercentage) || 0,
          totalPoints: Number(entry.total_points ?? entry.totalPoints) || 0,
          total_points: Number(entry.total_points ?? entry.totalPoints) || 0,
          currentStreak: Number(entry.current_streak ?? entry.currentStreak) || 0,
          current_streak: Number(entry.current_streak ?? entry.currentStreak) || 0,
          is_current_user: Boolean(entry.is_current_user),
        }))
        setLeaderboard(processedLeaderboard)

        const currentStudent = leaderboardData?.currentStudent
        if (currentStudent) {
          const rank = Number(currentStudent.rank) || 0
          const isInTopList = processedLeaderboard.some((entry) => entry.is_current_user)
          setCurrentStudentRank({
            rank,
            studentName: currentStudent.full_name || student?.name || "You",
            attendancePercentage:
              Number(currentStudent.attendance_percentage ?? currentStudent.attendancePercentage) ||
              attendancePercentage,
            totalPoints: Number(currentStudent.total_points ?? currentStudent.totalPoints) || 0,
            currentStreak: Number(currentStudent.current_streak ?? currentStudent.currentStreak) || 0,
            isInTopList,
          })
        } else if (scoreRes.ok) {
          setCurrentStudentRank({
            rank: 0,
            studentName: student?.name || "You",
            attendancePercentage,
            totalPoints: Number(streaksData.streak?.totalPoints) || 0,
            currentStreak: Number(streaksData.streak?.currentStreak) || 0,
            isInTopList: false,
          })
        } else {
          setCurrentStudentRank(null)
        }
      } else {
        setStats({
          classesAttended: 0,
          totalClasses: 0,
          attendancePercentage: 0,
          pointsEarned: 0,
          sessionsScheduledTotal: 0,
          currentStreak: 0,
          totalPoints: 0,
        })
        setLeaderboard([])
        setCurrentStudentRank(null)
      }
    } catch {
      setStats({
        classesAttended: 0,
        totalClasses: 0,
        attendancePercentage: 0,
        pointsEarned: 0,
        sessionsScheduledTotal: 0,
        currentStreak: 0,
        totalPoints: 0,
      })
      setLeaderboard([])
      setCurrentStudentRank(null)
    } finally {
      setLoading(false)
    }
  }

  const handleScanSuccess = () => {
    setShowScanner(false)
    if (studentData) {
      setTimeout(() => fetchAttendanceData(studentData.databaseId, studentData.section), 500)
    }
  }

  const openCodeFallback = async () => {
    const student = getStudentData()
    if (!student?.section) {
      toast({ title: "Error", description: "Unable to determine your section", variant: "destructive" })
      return
    }
    try {
      const res = await fetch(`/api/attendance/sessions?section=${student.section}&isActive=true`)
      const data = await res.json()
      if (data.sessions?.length > 0) {
        setCurrentSessionId(data.sessions[0].id)
        setShowFallbackModal(true)
      } else {
        toast({
          title: "No Active Session",
          description: "There are no active attendance sessions for your section.",
          variant: "destructive",
        })
      }
    } catch {
      toast({ title: "Error", description: "Could not load attendance sessions", variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div
          className={cn(
            "animate-spin h-12 w-12 border-2 border-[var(--border)] rounded-full",
            embedInDashboard ? studentModuleSpinnerClass("attendance") : "border-t-purple-500",
          )}
        />
      </div>
    )
  }

  const percentage = stats?.attendancePercentage || 0
  const streak = stats?.currentStreak || 0

  const btnPrimary = embedInDashboard
    ? PORTAL_CTA
    : "bg-[var(--cc-accent)] hover:opacity-90 shadow-lg"
  const btnOutline = embedInDashboard
    ? portalOutlineButtonClass(theme)
    : "border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50"

  return (
    <>
      <div className={cn(embedInDashboard ? "space-y-3" : "space-y-6 sm:space-y-8")}>
        {embedInDashboard ? (
          <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
            <div className="flex min-w-0 items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
                  Attendance
                </p>
                <p className="mt-0.5 truncate text-sm text-[var(--cc-text)]">
                  {percentage.toFixed(1)}%
                  <span className="text-[var(--cc-text-muted)]">
                    {" "}
                    · {stats?.classesAttended ?? 0}/{stats?.totalClasses ?? 0} sessions
                    {streak > 0 ? ` · ${streak}-day streak` : ""}
                    {stats?.totalPoints ? ` · ${stats.totalPoints} pts` : ""}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 rounded-xl px-2.5 text-[var(--cc-text)]"
                  onClick={() => void openCodeFallback()}
                >
                  <Hash className="h-4 w-4" />
                  <span className="ml-1.5 hidden sm:inline">Code</span>
                </Button>
                <Button
                  type="button"
                  className="h-9 rounded-xl border-0 px-3 shadow-none hover:opacity-90"
                  style={{ backgroundColor: "var(--cc-accent)", color: "#FFFFFF" }}
                  onClick={() => setShowScanner(true)}
                >
                  <QrCode className="h-4 w-4" />
                  <span className="ml-1.5 hidden sm:inline">Scan QR</span>
                </Button>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
              <div
                className="h-full rounded-full bg-[var(--cc-accent)]"
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>
        ) : null}

        {!embedInDashboard && (
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button onClick={() => setShowScanner(true)} size="lg" className={btnPrimary}>
              <QrCode className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Scan QR Code
            </Button>
            <Button
              onClick={() => void openCodeFallback()}
              size="lg"
              variant="outline"
              className={btnOutline}
            >
              <Hash className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Enter Code
            </Button>
            <Button onClick={() => router.push("/student/dashboard")} variant="outline" size="lg">
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 mr-2 rotate-180" />
              Back to Dashboard
            </Button>
          </div>
        )}

        {!embedInDashboard ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={statCard}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className={iconWellSm}>
                  <TrendingUp className={cn("h-3.5 w-3.5", iconAccent)} />
                </div>
                <p className={cn("text-[10px] sm:text-xs font-semibold uppercase tracking-wide truncate", PORTAL_TEXT_MUTED)}>
                  Attendance
                </p>
              </div>
              <span className={cn("text-base sm:text-lg font-bold tabular-nums shrink-0", iconAccent)}>
                {percentage.toFixed(1)}%
              </span>
            </div>
            <p className={cn("text-[10px] sm:text-xs leading-snug line-clamp-2 mb-2", PORTAL_TEXT_MUTED)}>
              {stats?.pointsEarned ?? 0} pts / {stats?.totalClasses ?? 0} scored session
              {(stats?.totalClasses ?? 0) === 1 ? "" : "s"}
              {(stats?.sessionsScheduledTotal ?? 0) > (stats?.totalClasses ?? 0)
                ? ` · ${stats?.sessionsScheduledTotal} scheduled`
                : ""}
            </p>
            <Progress
              value={percentage}
              className="h-1.5 bg-[var(--muted)] [&_[data-slot=progress-indicator]]:!bg-[var(--cc-accent)]"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={statCard}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className={iconWellSm}>
                  <Flame className={cn("h-3.5 w-3.5", iconAccent)} />
                </div>
                <p className={cn("text-[10px] sm:text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                  Streak
                </p>
              </div>
              {streak >= 5 ? (
                <Badge className={cn("text-[10px] px-1.5 py-0 h-5", pageTheme.badge)}>Hot!</Badge>
              ) : null}
            </div>
            <p className={cn("text-xl sm:text-2xl font-bold tabular-nums leading-none", iconAccent)}>
              {streak}
              <span className={cn("text-xs sm:text-sm font-normal ml-1", PORTAL_TEXT_MUTED)}>
                day{streak !== 1 ? "s" : ""}
              </span>
            </p>
            <p className={cn("mt-1.5 text-[10px] sm:text-xs", PORTAL_TEXT_MUTED)}>
              {streak >= 5 ? `+${Math.floor(streak / 5) * 5} bonus pts` : "Keep attending!"}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className={statCard}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <div className={iconWellSm}>
                  <Star className={cn("h-3.5 w-3.5 fill-[var(--cc-accent-dark)]", iconAccent)} />
                </div>
                <p className={cn("text-[10px] sm:text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                  Points
                </p>
              </div>
              <Trophy className={cn("h-3.5 w-3.5 shrink-0 opacity-70", iconAccent)} />
            </div>
            <p className={cn("text-xl sm:text-2xl font-bold tabular-nums leading-none", iconAccent)}>
              {stats?.totalPoints || 0}
            </p>
            <p className={cn("mt-1.5 text-[10px] sm:text-xs", PORTAL_TEXT_MUTED)}>+2 per class</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={statCard}
          >
            <p className={cn("text-[10px] sm:text-xs font-semibold uppercase tracking-wide mb-2", PORTAL_TEXT_MUTED)}>
              Quick links
            </p>
            <div className="flex flex-col gap-1">
              <Button
                onClick={() => router.push("/student/dashboard-v2/attendance/history")}
                variant="ghost"
                size="sm"
                className={cn("h-8 px-2 justify-start text-xs", PORTAL_TEXT, "hover:bg-[var(--cc-accent-soft)] hover:text-[var(--cc-accent-dark)]")}
              >
                <History className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                History
              </Button>
              <Button
                onClick={() => setShowScanner(true)}
                variant="ghost"
                size="sm"
                className={cn("h-8 px-2 justify-start text-xs", PORTAL_OUTLINE_BTN)}
              >
                <QrCode className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                Mark attendance
              </Button>
            </div>
          </motion.div>
        </div>
        ) : null}

        {embedInDashboard ? (
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h3 className="text-sm font-semibold text-[var(--cc-text)]">Leaderboard</h3>
              <p className="text-xs text-[var(--cc-text-muted)]">
                {currentStudentRank
                  ? `Your rank #${currentStudentRank.rank} · peer names hidden`
                  : "Peer names hidden for privacy"}
              </p>
            </div>
            {leaderboard.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--cc-text-muted)]">
                No rankings yet. Scan in to get on the board.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {currentStudentRank && !currentStudentRank.isInTopList ? (
                  <div className="flex h-[72px] items-center gap-3 bg-[var(--cc-accent-soft)] px-4">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
                      style={{ backgroundColor: "var(--cc-accent)", color: "#FFFFFF" }}
                    >
                      {currentStudentRank.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--cc-text)]">
                        {currentStudentRank.studentName} (You)
                      </p>
                      <p className="truncate text-xs text-[var(--cc-text-muted)]">
                        {currentStudentRank.attendancePercentage.toFixed(1)}%
                        {currentStudentRank.currentStreak > 0
                          ? ` · ${currentStudentRank.currentStreak}-day streak`
                          : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--cc-text)]">
                      {currentStudentRank.totalPoints}
                    </span>
                  </div>
                ) : null}
                {leaderboard.map((entry, index) => {
                  const isCurrentUser =
                    entry.is_current_user ||
                    (entry.id != null && String(entry.id) === studentData?.databaseId)
                  const rank = entry.rank || index + 1
                  const name = isCurrentUser
                    ? entry.full_name || entry.studentName || studentData?.name || "You"
                    : "Student"
                  const pct = Number(entry.attendance_percentage ?? entry.attendancePercentage) || 0
                  const pts = Number(entry.total_points ?? entry.totalPoints) || 0
                  const days = Number(entry.current_streak ?? entry.currentStreak) || 0
                  return (
                    <div
                      key={`rank-${rank}-${index}`}
                      className={cn(
                        "flex h-[72px] items-center gap-3 px-4",
                        isCurrentUser && "bg-[var(--cc-accent-soft)]",
                      )}
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
                        style={{
                          backgroundColor: isCurrentUser ? "var(--cc-accent)" : "var(--muted)",
                          color: isCurrentUser ? "#FFFFFF" : "var(--cc-text)",
                        }}
                      >
                        {rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--cc-text)]">
                          {name}
                          {isCurrentUser ? " (You)" : ""}
                        </p>
                        <p
                          className={cn(
                            "truncate text-xs text-[var(--cc-text-muted)]",
                            !isCurrentUser && "blur-[5px] select-none",
                          )}
                        >
                          {isCurrentUser
                            ? `${pct.toFixed(1)}%${days > 0 ? ` · ${days}-day streak` : ""}`
                            : "Hidden"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums text-[var(--cc-text)]",
                          !isCurrentUser && "blur-[5px] select-none",
                        )}
                      >
                        {isCurrentUser ? pts : "•••"}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div
            className={
              embedInDashboard
                ? cn("rounded-xl overflow-hidden shadow-sm", PORTAL_CARD)
                : "rounded-2xl border-0 shadow-xl bg-white dark:bg-slate-900 overflow-hidden"
            }
          >
            <div
              className={
                embedInDashboard
                  ? "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 py-5 sm:px-6 sm:py-6 border-b border-[var(--border)]"
                  : "relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 py-5 sm:px-6 sm:py-6 bg-[var(--cc-accent)]"
              }
            >
              {!embedInDashboard && <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />}
              <div className="relative flex items-center gap-4">
                <div
                  className={cn(
                    "p-3 rounded-xl shrink-0",
                    embedInDashboard ? cn(iconWell, "p-3") : "bg-white/20 backdrop-blur-sm",
                  )}
                >
                  <Trophy
                    className={cn(
                      "h-6 w-6",
                      embedInDashboard ? iconAccent : "text-amber-300",
                    )}
                  />
                </div>
                <div>
                  <h3
                    className={cn(
                      "text-lg sm:text-xl font-bold",
                      embedInDashboard ? PORTAL_TEXT : "text-white",
                    )}
                  >
                    Attendance Leaderboard
                  </h3>
                  <p
                    className={cn(
                      "text-sm mt-0.5",
                      embedInDashboard ? PORTAL_TEXT_MUTED : "text-purple-100",
                    )}
                  >
                    {currentStudentRank
                      ? `Your rank: #${currentStudentRank.rank} — other students are hidden for privacy`
                      : "See your rank among classmates (names hidden for privacy)"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {currentStudentRank && (
                  <Badge
                    className={
                      embedInDashboard
                        ? cn("px-3 py-1.5 text-sm font-semibold", pageTheme.badge)
                        : "bg-white/20 text-white border-white/30 px-3 py-1.5 text-sm font-semibold"
                    }
                  >
                    Your rank: #{currentStudentRank.rank}
                  </Badge>
                )}
                <Badge
                  className={
                    embedInDashboard
                      ? cn("px-3 py-1.5 text-sm font-semibold border", pageTheme.border, pageTheme.softBg, pageTheme.iconText)
                      : "bg-white/20 text-white border-white/30 px-3 py-1.5 text-sm font-semibold"
                  }
                >
                  Top {leaderboard.length}
                </Badge>
              </div>
            </div>
            <div className="p-0">
              {leaderboard.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 sm:py-20">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-[var(--cc-accent-soft)] rounded-full blur-2xl" />
                    <div className={cn("relative p-5 rounded-2xl border", pageTheme.iconBg, pageTheme.border)}>
                      <Trophy className={cn("h-12 w-12 sm:h-14 sm:w-14", iconAccent, "opacity-40")} />
                    </div>
                  </div>
                  <h4 className={cn("text-base font-semibold mb-1", PORTAL_TEXT)}>
                    No rankings yet
                  </h4>
                  <p className={cn("text-sm text-center max-w-xs", PORTAL_TEXT_MUTED)}>
                    Be the first to mark attendance and climb the leaderboard.
                  </p>
                  <Button
                    onClick={() => setShowScanner(true)}
                    variant="ghost"
                    size="sm"
                    className={cn("mt-6", PORTAL_OUTLINE_BTN)}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    Mark attendance
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 p-2">
                  {currentStudentRank && !currentStudentRank.isInTopList && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "relative p-3 sm:p-4 lg:p-5",
                        embedInDashboard
                          ? cn("ring-1 ring-inset ring-[var(--cc-accent-border)]", pageTheme.softBg)
                          : "bg-purple-50/80 dark:bg-purple-950/30 ring-1 ring-inset ring-purple-500/20",
                      )}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 w-full sm:w-auto">
                          <div
                            className={cn(
                              "w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-lg sm:rounded-xl flex items-center justify-center font-bold text-sm sm:text-base lg:text-lg border-2",
                              embedInDashboard
                                ? cn(pageTheme.iconBg, pageTheme.border, iconAccent)
                                : "text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
                            )}
                          >
                            {currentStudentRank.rank}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 sm:mb-1 flex-wrap">
                              <p
                                className={cn(
                                  "font-bold text-base sm:text-lg truncate",
                                  embedInDashboard ? iconAccent : "text-purple-700 dark:text-purple-300",
                                )}
                              >
                                {currentStudentRank.studentName}
                              </p>
                              <Badge
                                className={
                                  embedInDashboard
                                    ? cn("text-white text-xs px-1.5 sm:px-2 py-0.5 flex-shrink-0", PORTAL_CTA)
                                    : "bg-purple-500 text-white text-xs px-1.5 sm:px-2 py-0.5 flex-shrink-0"
                                }
                              >
                                You
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500" />
                                <span className={cn("text-xs sm:text-sm font-semibold", PORTAL_TEXT)}>
                                  {currentStudentRank.attendancePercentage.toFixed(1)}%
                                </span>
                              </div>
                              {currentStudentRank.currentStreak > 0 && (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-orange-300 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 px-1.5 sm:px-2"
                                >
                                  <Flame className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                  {currentStudentRank.currentStreak} day
                                  {currentStudentRank.currentStreak !== 1 ? "s" : ""}
                                </Badge>
                              )}
                              <div className="flex-1 min-w-[80px] sm:min-w-[100px] max-w-full sm:max-w-[150px]">
                                <Progress
                                  value={currentStudentRank.attendancePercentage}
                                  className="h-1.5 sm:h-2 bg-[var(--muted)] [&_[data-slot=progress-indicator]]:!bg-[var(--cc-accent)]"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right w-full sm:w-auto flex sm:block justify-end sm:justify-start">
                          <div
                            className={cn(
                              "inline-flex flex-col items-end gap-0.5 sm:gap-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-white shadow-md sm:shadow-lg",
                              embedInDashboard ? PORTAL_CTA : "bg-purple-500",
                            )}
                          >
                            <span className="text-xl sm:text-2xl font-bold">{currentStudentRank.totalPoints}</span>
                            <span className="text-xs opacity-90">points</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {leaderboard.map((entry, index) => {
                    const isCurrentUser =
                      entry.is_current_user ||
                      (entry.id != null && String(entry.id) === studentData?.databaseId)
                    const attendancePercentage = isCurrentUser
                      ? Number(entry.attendance_percentage ?? entry.attendancePercentage) || 0
                      : 0
                    const totalPoints = isCurrentUser
                      ? Number(entry.total_points ?? entry.totalPoints) || 0
                      : 0
                    const currentStreak = isCurrentUser
                      ? Number(entry.current_streak ?? entry.currentStreak) || 0
                      : 0
                    const studentName = isCurrentUser
                      ? entry.full_name || entry.studentName || studentData?.name || "You"
                      : "Student"
                    const rank = entry.rank || index + 1

                    return (
                      <motion.div
                        key={`rank-${rank}-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          "group relative p-3 sm:p-4 lg:p-5 transition-all",
                          embedInDashboard
                            ? cn(
                                "hover:bg-[var(--cc-accent-soft)]/40",
                                isCurrentUser && "ring-1 ring-inset ring-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)]/60",
                              )
                            : `hover:bg-purple-50/50 dark:hover:bg-purple-950/20 ${
                                isCurrentUser
                                  ? "bg-purple-50/80 dark:bg-purple-950/30 ring-1 ring-inset ring-purple-500/20"
                                  : ""
                              }`,
                        )}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 w-full sm:w-auto">
                            <div className="relative flex-shrink-0">
                              {index < 3 ? (
                                <div
                                  className={`w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-lg sm:rounded-xl flex items-center justify-center font-bold text-sm sm:text-base lg:text-lg shadow-md sm:shadow-lg ${
                                    embedInDashboard
                                      ? index === 0
                                        ? "bg-amber-500 text-white dark:bg-amber-500"
                                        : index === 1
                                          ? "bg-slate-400 text-white dark:bg-slate-500"
                                          : "bg-orange-500 text-white dark:bg-orange-600"
                                      : index === 0
                                        ? "bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 text-white"
                                        : index === 1
                                          ? "bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 text-white"
                                          : "bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 text-white"
                                  }`}
                                >
                                  {index === 0 && <Trophy className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />}
                                  {index === 1 && <Award className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />}
                                  {index === 2 && <Star className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />}
                                </div>
                              ) : (
                                <div
                                  className={cn(
                                    "w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-lg sm:rounded-xl flex items-center justify-center font-bold text-sm sm:text-base lg:text-lg border-2",
                                    embedInDashboard
                                      ? cn(pageTheme.iconBg, pageTheme.border, iconAccent)
                                      : "text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800",
                                  )}
                                >
                                  {rank}
                                </div>
                              )}
                            </div>
                            <div
                              className={`flex-1 min-w-0 ${!isCurrentUser ? "blur-[6px] select-none pointer-events-none" : ""}`}
                              aria-hidden={!isCurrentUser}
                            >
                              <div className="flex items-center gap-2 mb-1.5 sm:mb-1 flex-wrap">
                                <p
                                  className={cn(
                                    "font-bold text-base sm:text-lg truncate",
                                    isCurrentUser
                                      ? embedInDashboard
                                        ? iconAccent
                                        : "text-purple-700 dark:text-purple-300"
                                      : PORTAL_TEXT_MUTED,
                                  )}
                                >
                                  {studentName}
                                </p>
                                {isCurrentUser && (
                                  <Badge
                                    className={
                                      embedInDashboard
                                        ? cn("text-white text-xs px-1.5 sm:px-2 py-0.5 flex-shrink-0", PORTAL_CTA)
                                        : "bg-purple-500 text-white text-xs px-1.5 sm:px-2 py-0.5 flex-shrink-0"
                                    }
                                  >
                                    You
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                {isCurrentUser ? (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500" />
                                      <span className={cn("text-xs sm:text-sm font-semibold", PORTAL_TEXT)}>
                                        {attendancePercentage.toFixed(1)}%
                                      </span>
                                    </div>
                                    {currentStreak > 0 && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs border-orange-300 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 px-1.5 sm:px-2"
                                      >
                                        <Flame className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                        {currentStreak} day{currentStreak !== 1 ? "s" : ""}
                                      </Badge>
                                    )}
                                    <div className="flex-1 min-w-[80px] sm:min-w-[100px] max-w-full sm:max-w-[150px]">
                                      <Progress
                                        value={attendancePercentage}
                                        className="h-1.5 sm:h-2 bg-[var(--muted)] [&_[data-slot=progress-indicator]]:!bg-[var(--cc-accent)]"
                                      />
                                    </div>
                                  </>
                                ) : (
                                  <span className={cn("text-xs sm:text-sm", PORTAL_TEXT_MUTED)}>
                                    Details hidden
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right w-full sm:w-auto flex sm:block justify-end sm:justify-start">
                            {isCurrentUser ? (
                              <div
                                className={cn(
                                  "inline-flex flex-col items-end gap-0.5 sm:gap-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-white shadow-md sm:shadow-lg",
                                  embedInDashboard ? PORTAL_CTA : "bg-purple-500",
                                )}
                              >
                                <span className="text-xl sm:text-2xl font-bold">{totalPoints}</span>
                                <span className="text-xs opacity-90">points</span>
                              </div>
                            ) : (
                              <div className="inline-flex flex-col items-end gap-0.5 sm:gap-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-[var(--muted)] text-[var(--cc-text-muted)] blur-[6px] select-none pointer-events-none">
                                <span className="text-xl sm:text-2xl font-bold">•••</span>
                                <span className="text-xs opacity-90">points</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
        )}
      </div>

      {showScanner && (
        <StudentQRScanner
          studentId={studentData?.databaseId}
          onSuccess={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showFallbackModal && currentSessionId && studentData && (
        <StudentFallbackModal
          isOpen={showFallbackModal}
          onClose={() => {
            setShowFallbackModal(false)
            setCurrentSessionId(null)
          }}
          onSuccess={() => {
            setShowFallbackModal(false)
            setCurrentSessionId(null)
            fetchAttendanceData(studentData.databaseId, studentData.section)
          }}
          sessionId={currentSessionId}
          studentId={studentData.databaseId}
        />
      )}
    </>
  )
}
