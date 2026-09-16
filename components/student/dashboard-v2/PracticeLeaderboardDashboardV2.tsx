"use client"

import { useState, useEffect, useMemo, type LucideIcon } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge as UIBadge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Lightbulb,
  Trophy,
  Award,
  Flame,
  Crown,
  Medal,
  TrendingUp,
  Calendar,
  Play,
  Lock,
  Layers,
  Percent,
  Target,
} from "lucide-react"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { getStudentCourseIdFromSession } from "@/lib/student-session-ids"
import { cn } from "@/lib/utils"
import { initialsFromName } from "@/lib/initials-from-name"
import { usePracticeChrome } from "@/hooks/use-practice-chrome"
import { practiceChromeKpi } from "@/lib/practice-chrome-theme"
import { ThemeKpiCard } from "@/components/student/dashboard-v2/ThemeKpiCard"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { ctaInkOnFill } from "@/lib/appearance/chrome-ink"
import { motion } from "@/components/student/dashboard-v2/light-motion"

interface LeaderboardEntry {
  rank: number
  student_name?: string
  student_code?: string
  student_id?: number
  section?: string
  total_practice_points?: number
  total_practice_attempts?: number
  current_streak_days?: number
  avg_practice_score?: number
  is_current_user?: boolean
}

interface Badge {
  badge_type: string
  badge_name: string
  badge_description: string
  earned_at: string
}

function PodiumPlace({
  entry,
  place,
  blurPeerNames,
  accentFill,
  accentInk,
  pedestalH,
}: {
  entry: LeaderboardEntry
  place: 1 | 2 | 3
  blurPeerNames: boolean
  accentFill: string
  accentInk: string
  pedestalH: string
}) {
  const isFirst = place === 1
  const size = isFirst ? "size-20" : "size-16"
  const Icon = place === 1 ? Crown : Medal
  // Rise order: silver → bronze → gold (center lands last)
  const delay = place === 2 ? 0 : place === 3 ? 0.12 : 0.28

  return (
    <motion.div
      className="flex min-w-0 flex-1 flex-col items-center"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative mb-3">
        <div
          className={cn(
            "flex items-center justify-center rounded-full font-bold text-white shadow-[0_8px_20px_rgba(0,0,0,0.25)]",
            size,
            blurPeerNames && "blur-[4px]",
          )}
          style={{ backgroundColor: accentFill, color: accentInk }}
        >
          <span className={cn(isFirst ? "text-2xl" : "text-xl")} style={{ color: accentInk }}>
            {blurPeerNames ? "#" : initialsFromName(entry.student_name, String(place))}
          </span>
        </div>
        <div
          className="pointer-events-none absolute -right-1 -top-1 z-10 flex size-7 items-center justify-center rounded-full shadow-md"
          style={{ backgroundColor: accentFill, color: accentInk }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: accentInk }} />
        </div>
      </div>
      <motion.div
        className={cn("mb-3 w-full text-center", blurPeerNames && "blur-[6px] select-none")}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: delay + 0.28 }}
      >
        <p className="truncate text-sm font-semibold text-[var(--cc-text)]">
          {blurPeerNames ? "Student" : entry.student_name || "Student"}
        </p>
        <p className="text-xs text-[var(--cc-text-muted)]">#{entry.rank}</p>
        <p className="mt-1 text-sm font-bold tabular-nums text-[var(--cc-text)]">
          {blurPeerNames ? "••• XP" : `${(entry.total_practice_points ?? 0).toLocaleString()} XP`}
        </p>
      </motion.div>
      <motion.div
        className={cn("flex w-full origin-bottom items-end justify-center rounded-t-2xl", pedestalH)}
        style={{
          backgroundColor: accentFill,
          color: accentInk,
          boxShadow: "0 -4px 18px rgba(0,0,0,0.2)",
        }}
        initial={{ scaleY: 0, opacity: 0.5 }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.span
          className="pb-3 text-2xl font-bold tabular-nums"
          style={{ color: accentInk }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.4, duration: 0.25 }}
        >
          {place}
        </motion.span>
      </motion.div>
    </motion.div>
  )
}

export function PracticeLeaderboardDashboardV2() {
  const router = useRouter()
  const { roles, accent, soft, mid } = usePracticeChrome()
  usePreventBack("/student/login")

  const [studentId, setStudentId] = useState<number | null>(null)
  const [studentName, setStudentName] = useState("")
  const [studentSession, setStudentSession] = useState("")
  const [loading, setLoading] = useState(true)
  const [leaderboardLocked, setLeaderboardLocked] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [currentStudent, setCurrentStudent] = useState<LeaderboardEntry | null>(null)
  const [badges, setBadges] = useState<Badge[]>([])
  const [blurPeerNames, setBlurPeerNames] = useState(false)
  const [showAccuracyOnLeaderboard, setShowAccuracyOnLeaderboard] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)
  const [topicCount, setTopicCount] = useState(0)

  const gold = practiceChromeKpi(4, roles)
  const silver = practiceChromeKpi(1, roles)
  const bronze = practiceChromeKpi(6, roles)
  const ctaInk = ctaInkOnFill(roles.cta.fill)

  useEffect(() => {
    const studentData = getStudentData()
    if (!studentData?.databaseId) {
      router.push("/student/login")
      return
    }

    const studentDbId = Number.parseInt(studentData.databaseId)
    const courseId = getStudentCourseIdFromSession()

    setStudentId(studentDbId)
    setStudentName(studentData.name)
    setStudentSession(studentData.section || "")

    void Promise.all([
      fetchLeaderboard(studentDbId, studentData.section, courseId),
      fetchAnalytics(studentDbId),
      fetchTopicCount(studentDbId, studentData.section, courseId),
    ]).finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    if (loading) return
    if (typeof window === "undefined" || window.location.hash !== "#badges") return
    requestAnimationFrame(() => {
      document.getElementById("badges")?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [loading, badges.length])

  const fetchLeaderboard = async (studentDbId: number, session: string, courseId: number | null) => {
    try {
      const courseQs = courseId != null ? `&courseId=${courseId}` : ""
      const response = await studentApiFetch(
        `/api/practice/leaderboard?studentId=${studentDbId}&session=${encodeURIComponent(session)}&limit=100${courseQs}`,
      )
      const data = await response.json()
      if (response.status === 403) {
        setLeaderboardLocked(true)
        setLeaderboard([])
        setCurrentStudent(null)
        setBadges([])
        return
      }
      if (response.ok) {
        setLeaderboardLocked(false)
        setLeaderboard(data.leaderboard || [])
        setCurrentStudent(data.currentStudent)
        setBadges(data.badges || [])
        setBlurPeerNames(data.leaderboardPrivacy?.blurPeerNames ?? data.privacyMode ?? false)
        setShowAccuracyOnLeaderboard(data.leaderboardDisplay?.showAccuracy ?? true)
      }
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error)
    }
  }

  const fetchAnalytics = async (studentDbId: number) => {
    try {
      const response = await studentApiFetch(`/api/practice/analytics?studentId=${studentDbId}`)
      const data = await response.json()
      if (response.ok) setAnalytics(data)
    } catch (error) {
      console.error("Failed to fetch analytics:", error)
    }
  }

  const fetchTopicCount = async (
    studentDbId: number,
    session: string,
    courseId: number | null,
  ) => {
    try {
      const courseQs = courseId != null ? `&courseId=${courseId}` : ""
      const response = await studentApiFetch(
        `/api/practice/topics-progress?studentId=${studentDbId}&session=${encodeURIComponent(session)}${courseQs}`,
      )
      const data = await response.json()
      if (response.ok) setTopicCount((data.topics || []).length)
    } catch (error) {
      console.error("Failed to fetch topics:", error)
    }
  }

  const kpiStats = useMemo(() => {
    if (!currentStudent) return []
    const stats: Array<{
      label: string
      value: string | number
      icon: LucideIcon
      thumbIndex: number
      footer: string
    }> = [
      {
        label: "XP Points",
        value: currentStudent.total_practice_points ?? 0,
        icon: Trophy,
        thumbIndex: 0,
        footer: `Rank #${currentStudent.rank}`,
      },
      {
        label: "Sessions",
        value: currentStudent.total_practice_attempts ?? 0,
        icon: Layers,
        thumbIndex: 1,
        footer: "Practice attempts",
      },
    ]
    if (showAccuracyOnLeaderboard) {
      stats.push({
        label: "Avg Score",
        value: `${Number(currentStudent.avg_practice_score || 0).toFixed(0)}%`,
        icon: Percent,
        thumbIndex: 2,
        footer: "Across sessions",
      })
    }
    stats.push({
      label: "Badges",
      value: badges.length,
      icon: Award,
      thumbIndex: 3,
      footer: badges.length === 1 ? "Badge earned" : "Badges earned",
    })
    return stats
  }, [currentStudent, badges.length, showAccuracyOnLeaderboard])

  const topThree = leaderboard.slice(0, 3)
  const rankedList = topThree.length >= 3 ? leaderboard.slice(3) : leaderboard

  if (loading) {
    return (
      <div className={cn("flex min-h-[280px] items-center justify-center", EMBED_MATERIAL_PANEL)}>
        <div className="animate-pulse p-12 text-[var(--cc-text-muted)]">Loading leaderboard…</div>
      </div>
    )
  }

  if (leaderboardLocked) {
    return (
      <div className="space-y-4 sm:space-y-5">
        <div className={cn("flex flex-col items-center gap-4 px-6 py-12 text-center", EMBED_MATERIAL_PANEL)}>
          <SolidListThumbTile thumb={roles.topicLocked} icon={Lock} />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-[var(--cc-text)]">Leaderboard locked</h3>
            <p className="max-w-md text-sm text-[var(--cc-text-muted)]">
              Upgrade to Explorer or Trailblazer to view rankings and compete with classmates.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              className="rounded-xl border-0 shadow-sm hover:opacity-90"
              style={{ backgroundColor: roles.cta.fill, color: ctaInk }}
              onClick={() => router.push("/student/dashboard-v2/membership")}
            >
              View plans
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5 min-w-0">
      {kpiStats.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 pt-3 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-5">
          {kpiStats.map((stat) => (
            <ThemeKpiCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              thumb={practiceChromeKpi(stat.thumbIndex, roles)}
              footer={stat.footer}
            />
          ))}
        </div>
      ) : null}

      {topThree.length >= 3 ? (
        <div className={cn("overflow-hidden p-4 sm:p-6", EMBED_MATERIAL_PANEL)}>
          <div className="mb-5 flex items-center gap-2.5">
            <SolidListThumbTile thumb={roles.leaderboard} icon={Trophy} size="compact" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--cc-text)]">Top practitioners</h3>
              <p className="text-xs text-[var(--cc-text-muted)]">
                {blurPeerNames
                  ? "Names hidden for privacy"
                  : `${studentSession || "Class"} podium`}
              </p>
            </div>
          </div>
          <div className="flex items-end justify-center gap-2 sm:gap-4">
            <PodiumPlace
              entry={topThree[1]!}
              place={2}
              blurPeerNames={blurPeerNames}
              accentFill={silver.fill}
              accentInk={silver.icon}
              pedestalH="h-20 sm:h-24"
            />
            <PodiumPlace
              entry={topThree[0]!}
              place={1}
              blurPeerNames={blurPeerNames}
              accentFill={gold.fill}
              accentInk={gold.icon}
              pedestalH="h-28 sm:h-36"
            />
            <PodiumPlace
              entry={topThree[2]!}
              place={3}
              blurPeerNames={blurPeerNames}
              accentFill={bronze.fill}
              accentInk={bronze.icon}
              pedestalH="h-16 sm:h-20"
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <div className="space-y-4 lg:col-span-1">
          {currentStudent ? (
            <div className={cn("p-4 sm:p-5", EMBED_MATERIAL_PANEL)}>
              <div className="flex items-center gap-3">
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{ backgroundColor: roles.cta.fill, color: ctaInk }}
                >
                  {initialsFromName(studentName, "ST")}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-[var(--cc-text)]">{studentName}</h3>
                  <p className="text-xs text-[var(--cc-text-muted)]">{studentSession}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[var(--cc-text-secondary)]">
                  Rank #{currentStudent.rank}
                </span>
                {(currentStudent.current_streak_days ?? 0) > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ backgroundColor: roles.streak.fill, color: roles.streak.icon }}
                  >
                    <Flame className="h-3 w-3" />
                    {currentStudent.current_streak_days} day streak
                  </span>
                ) : null}
              </div>
              {analytics?.xpInfo ? (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--cc-text-muted)]">
                      Level {analytics.xpInfo.current_level}
                    </span>
                    <span className="font-medium tabular-nums text-[var(--cc-text)]">
                      {analytics.xpInfo.level_progress} / {analytics.xpInfo.xp_to_next_level} XP
                    </span>
                  </div>
                  <Progress
                    value={
                      (analytics.xpInfo.level_progress / Math.max(1, analytics.xpInfo.xp_to_next_level)) *
                      100
                    }
                    className="h-1.5"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={cn("p-4 sm:p-5", EMBED_MATERIAL_PANEL)}>
            <div className="mb-3 flex items-center gap-2.5">
              <SolidListThumbTile thumb={roles.summary} icon={Target} size="compact" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--cc-text)]">Practice insights</h3>
                <p className="text-xs text-[var(--cc-text-muted)]">Your learning snapshot</p>
              </div>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {[
                { label: "Sessions", value: currentStudent?.total_practice_attempts || 0 },
                ...(showAccuracyOnLeaderboard
                  ? [
                      {
                        label: "Avg Score",
                        value: `${Number(currentStudent?.avg_practice_score || 0).toFixed(0)}%`,
                      },
                    ]
                  : []),
                { label: "Streak", value: currentStudent?.current_streak_days || 0 },
                { label: "Topics", value: topicCount },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-[var(--muted)]/35 px-3 py-2.5 dark:bg-white/[0.04]">
                  <div className="text-base font-semibold tabular-nums text-[var(--cc-text)]">{s.value}</div>
                  <div className="text-[11px] text-[var(--cc-text-muted)]">{s.label}</div>
                </div>
              ))}
            </div>
            <div
              className="mb-3 rounded-xl p-3"
              style={{ backgroundColor: `${soft}33` }}
            >
              <div className="flex items-start gap-2.5">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
                <p className="text-xs leading-relaxed text-[var(--cc-text-secondary)]">
                  {currentStudent?.total_practice_attempts === 0
                    ? "Start your first practice session to begin tracking your progress!"
                    : Number(currentStudent?.avg_practice_score || 0) >= 80
                      ? "Excellent work! Try more challenging topics next."
                      : Number(currentStudent?.avg_practice_score || 0) >= 60
                        ? "Good progress — review misses to climb higher."
                        : "Keep practicing! Every session helps you improve."}
                </p>
              </div>
            </div>
            <Button
              onClick={() => router.push("/student/dashboard-v2/practice")}
              className="h-10 w-full rounded-xl border-0 shadow-sm hover:opacity-90"
              style={{ backgroundColor: roles.cta.fill, color: ctaInk }}
            >
              <Play className="mr-2 h-4 w-4" />
              Start new practice
            </Button>
          </div>

          {badges.length > 0 ? (
            <div id="badges" className={cn("scroll-mt-24 p-4 sm:p-5", EMBED_MATERIAL_PANEL)}>
              <div className="mb-3 flex items-center gap-2.5">
                <SolidListThumbTile thumb={roles.streak} icon={Award} size="compact" />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--cc-text)]">Badge collection</h3>
                  <p className="text-xs text-[var(--cc-text-muted)]">Achievements unlocked</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {badges.map((badge, index) => (
                  <div
                    key={`${badge.badge_type}-${index}`}
                    className="rounded-xl bg-[var(--muted)]/35 px-3 py-3 text-center dark:bg-white/[0.04]"
                  >
                    <Award className="mx-auto mb-1.5 h-6 w-6" style={{ color: accent }} />
                    <div className="text-xs font-medium text-[var(--cc-text)]">{badge.badge_name}</div>
                    <div className="mt-1 line-clamp-2 text-[10px] text-[var(--cc-text-muted)]">
                      {badge.badge_description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {analytics?.activityHeatmap ? (
            <div className={cn("p-4 sm:p-5", EMBED_MATERIAL_PANEL)}>
              <div className="mb-3 flex items-center gap-2.5">
                <SolidListThumbTile thumb={roles.recent} icon={Calendar} size="compact" />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--cc-text)]">Practice activity</h3>
                  <p className="text-xs text-[var(--cc-text-muted)]">Last 28 days</p>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 28 }).map((_, i) => {
                  const date = new Date()
                  date.setDate(date.getDate() - (27 - i))
                  const dateStr = date.toISOString().split("T")[0]
                  const activity = analytics.activityHeatmap.find(
                    (a: { date: string; sessions?: number }) => a.date.split("T")[0] === dateStr,
                  )
                  const sessions = activity?.sessions || 0
                  const opacity = sessions === 0 ? 0.12 : sessions === 1 ? 0.35 : sessions === 2 ? 0.65 : 1
                  return (
                    <div
                      key={i}
                      className="aspect-square rounded-sm"
                      style={{ backgroundColor: accent, opacity }}
                      title={`${dateStr}: ${sessions} session${sessions !== 1 ? "s" : ""}`}
                    />
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-2">
          <div className={cn("p-4 sm:p-5", EMBED_MATERIAL_PANEL)}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--cc-text)]">
                  <Trophy className="h-4 w-4" style={{ color: accent }} />
                  {studentSession || "Class"} rankings
                </h3>
                <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">
                  {currentStudent
                    ? blurPeerNames
                      ? `Your rank: #${currentStudent.rank} — peers hidden for privacy`
                      : `Your rank: #${currentStudent.rank} — full class rankings`
                    : "Rankings by XP"}
                </p>
              </div>
              <UIBadge variant="secondary" className="text-xs">
                {leaderboard.length} students
              </UIBadge>
            </div>

            {leaderboard.length === 0 ? (
              <div className="py-10 text-center">
                <Trophy className="mx-auto mb-3 h-10 w-10 text-[var(--cc-text-muted)]" />
                <p className="font-medium text-[var(--cc-text)]">No practice data yet</p>
                <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
                  Start practicing to appear on the leaderboard.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {rankedList.map((entry) => {
                  const isCurrentStudent =
                    entry.is_current_user ||
                    entry.student_code === studentId?.toString() ||
                    entry.student_id === studentId
                  const hidePeerDetails = blurPeerNames && !isCurrentStudent
                  const rankThumb =
                    entry.rank === 1
                      ? gold
                      : entry.rank === 2
                        ? silver
                        : entry.rank === 3
                          ? bronze
                          : isCurrentStudent
                            ? roles.cta
                            : practiceChromeKpi(entry.rank % 6, roles)

                  return (
                    <div
                      key={`rank-${entry.rank}`}
                      className={cn(
                        "rounded-xl px-3 py-3 transition-colors sm:px-4",
                        "bg-[var(--muted)]/30 dark:bg-white/[0.035]",
                        isCurrentStudent && "ring-2 ring-[var(--cc-accent-border)]",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                          style={{ backgroundColor: rankThumb.fill, color: rankThumb.icon }}
                        >
                          {entry.rank === 1 ? <Crown className="h-4 w-4" /> : entry.rank}
                        </div>
                        <div
                          className={cn(
                            "min-w-0 flex-1",
                            hidePeerDetails && "blur-[6px] select-none",
                          )}
                        >
                          <p
                            className={cn(
                              "truncate text-sm font-semibold",
                              isCurrentStudent ? "text-[var(--cc-text)]" : "text-[var(--cc-text)]",
                            )}
                          >
                            {isCurrentStudent
                              ? entry.student_name || studentName || "You"
                              : hidePeerDetails
                                ? "Student"
                                : entry.student_name || "Student"}
                            {isCurrentStudent ? (
                              <span className="ml-1.5 text-xs font-normal text-[var(--cc-text-muted)]">
                                (You)
                              </span>
                            ) : null}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--cc-text-muted)]">
                            {hidePeerDetails ? (
                              <span>Details hidden</span>
                            ) : (
                              <>
                                <span>{entry.section}</span>
                                <span>· {entry.total_practice_attempts} sessions</span>
                                {(entry.current_streak_days ?? 0) > 0 ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Flame className="h-3 w-3" style={{ color: accent }} />
                                    {entry.current_streak_days}d
                                  </span>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "flex shrink-0 items-center gap-3 text-right",
                            hidePeerDetails && "blur-[6px] select-none",
                          )}
                        >
                          {!hidePeerDetails || isCurrentStudent ? (
                            <>
                              <div>
                                <div className="text-base font-semibold tabular-nums text-[var(--cc-text)]">
                                  {(entry.total_practice_points ?? 0).toLocaleString()}
                                </div>
                                <div className="text-[10px] text-[var(--cc-text-muted)]">XP</div>
                              </div>
                              {showAccuracyOnLeaderboard ? (
                                <div>
                                  <div className="text-base font-semibold tabular-nums text-[var(--cc-text)]">
                                    {Number(entry.avg_practice_score || 0).toFixed(0)}%
                                  </div>
                                  <div className="text-[10px] text-[var(--cc-text-muted)]">Avg</div>
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-[var(--cc-text-muted)]">•••</span>
                          )}
                        </div>
                      </div>
                      {leaderboard[0] && isCurrentStudent ? (
                        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[var(--muted)] dark:bg-white/10">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${((entry.total_practice_points ?? 0) / (leaderboard[0].total_practice_points || 1)) * 100}%`,
                              backgroundColor: accent,
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}

            {leaderboard.length > 0 ? (
              <div
                className="mt-4 flex items-center gap-3 rounded-xl p-3.5"
                style={{ backgroundColor: `${mid}22` }}
              >
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: roles.icon.fill, color: roles.icon.icon }}
                >
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--cc-text)]">
                    Keep practicing to climb the leaderboard
                  </p>
                  <p className="text-xs text-[var(--cc-text-muted)]">
                    Earn XP from sessions · Track progress · Compete with classmates
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
