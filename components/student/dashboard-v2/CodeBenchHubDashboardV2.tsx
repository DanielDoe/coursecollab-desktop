"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Award,
  BarChart3,
  Code2,
  Flame,
  Sparkles,
  Target,
  Trophy,
  Zap,
  ChevronRight,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { ThemeKpiCard } from "@/components/student/dashboard-v2/ThemeKpiCard"
import { CODEBENCH_PANEL } from "@/lib/codebench/codebench-surface-classes"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { resolveStudentDatabaseId, studentApiFetch } from "@/lib/auth"
import { codebenchChromeKpi } from "@/lib/codebench-chrome-theme"
import { getCurrentXP } from "@/lib/codebench-xp"
import { cn } from "@/lib/utils"
import { resolveCodebenchEditorCode, readStoredCodebenchLanguageId } from "@/lib/codebench-languages"
import type { MembershipTier } from "@/lib/membership-constants"
import { studentTierHasCodeBenchCoraAccess } from "@/lib/codebench-entitlement-client"
import { CodebenchCoraUpgradeModal } from "@/components/codebench/CodebenchCoraUpgradeModal"
import { useCodebenchCoraGate } from "@/hooks/use-codebench-cora-gate"
import { CodebenchStudioCoach } from "@/components/codebench/CodebenchStudioCoach"
import { DailyChallengeCard } from "@/components/codebench/DailyChallengeCard"
import { StudentLiveClassroomBanner } from "@/components/codebench/StudentLiveClassroomBanner"
import { useStudentLiveClassroomSessions } from "@/hooks/use-student-live-classroom-sessions"
import { LIVE_JOIN_GRACE_MS, shouldTreatLiveSessionAsEnded } from "@/lib/codebench-live-student-ui"
import type { StudentLiveClassroomSession } from "@/lib/codebench-live-classroom-types"
import { CodebenchChallengeCoraDrawer } from "@/components/codebench/CodebenchChallengeCoraDrawer"
import {
  CODEBENCH_CORA_TOOLS,
  CodebenchCoraToolsStudio,
} from "@/components/codebench/CodebenchCoraToolsStudio"
import {
  setCodebenchChallengeHandoff,
  type CodebenchChallengeHandoff,
} from "@/lib/codebench-challenge-handoff"
import {
  CodebenchAnalyticsSkeleton,
  CodebenchBadgesSkeleton,
  CodebenchChallengeSkeleton,
  CodebenchEditorSkeleton,
  CodebenchLeaderboardSkeleton,
  CodebenchStreakSkeleton,
} from "@/components/codebench/CodebenchSkeletons"

const BadgesTab = dynamic(
  () => import("@/components/codebench/MoreMenu/BadgesTab").then((m) => ({ default: m.BadgesTab })),
  { loading: () => <CodebenchBadgesSkeleton /> },
)
const LeaderboardTab = dynamic(
  () => import("@/components/codebench/MoreMenu/LeaderboardTab").then((m) => ({ default: m.LeaderboardTab })),
  { loading: () => <CodebenchLeaderboardSkeleton /> },
)
const StreakTab = dynamic(
  () => import("@/components/codebench/MoreMenu/StreakTab").then((m) => ({ default: m.StreakTab })),
  { loading: () => <CodebenchStreakSkeleton /> },
)
const AnalyticsTab = dynamic(
  () => import("@/components/codebench/MoreMenu/AnalyticsTab").then((m) => ({ default: m.AnalyticsTab })),
  { loading: () => <CodebenchAnalyticsSkeleton /> },
)
const CodebenchInlineEditor = dynamic(
  () => import("@/components/codebench/CodebenchInlineEditor").then((m) => ({ default: m.CodebenchInlineEditor })),
  { ssr: false, loading: () => <CodebenchEditorSkeleton className="min-h-[320px] flex-1" /> },
)

const MODULE_ID = "codebench"

type HubStats = {
  streakDays: number
  badgeCount: number
  xp: number
  rank: number | null
  challenge: CodebenchChallengeHandoff | null
  topBadges: Array<{ id: string; name: string; icon: string }>
  leaderboardPreview: Array<{ rank: number; student_name: string; xp: number }>
}

type BrowseView =
  | "overview"
  | "editor"
  | "challenge"
  | "tools"
  | "badges"
  | "leaderboard"
  | "streak"
  | "analytics"

const HUB_STATS_CACHE_KEY = "codebench_hub_stats_cache_v1"

const EMPTY_STATS: HubStats = {
  streakDays: 0,
  badgeCount: 0,
  xp: 0,
  rank: null,
  challenge: null,
  topBadges: [],
  leaderboardPreview: [],
}

function readCachedHubStats(): HubStats | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(HUB_STATS_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as HubStats
  } catch {
    return null
  }
}

function writeCachedHubStats(stats: HubStats) {
  try {
    sessionStorage.setItem(HUB_STATS_CACHE_KEY, JSON.stringify(stats))
  } catch {
    // ignore
  }
}

function CodebenchStatCell({
  label,
  value,
  icon: Icon,
  thumbIndex,
  footer,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  thumbIndex: number
  footer?: string
}) {
  const { roles } = useCodebenchChrome()
  return (
    <ThemeKpiCard
      label={label}
      value={value}
      icon={Icon}
      thumb={codebenchChromeKpi(thumbIndex, roles)}
      footer={footer}
    />
  )
}

export function CodeBenchHubDashboardV2() {
  const router = useRouter()
  const { isDark } = useAppearance()
  const { soft, accent, roles } = useCodebenchChrome()
  const [studentId, setStudentId] = useState<string | null>(() =>
    typeof window !== "undefined" ? resolveStudentDatabaseId() : null,
  )
  const [statsLoading, setStatsLoading] = useState(() => !readCachedHubStats())
  const [challengeLoading, setChallengeLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState<HubStats>(() => readCachedHubStats() ?? EMPTY_STATS)
  const [tier, setTier] = useState<MembershipTier | null>(null)
  const coraGate = useCodebenchCoraGate(tier)
  const hasCora = studentTierHasCodeBenchCoraAccess(tier)
  const [browseView, setBrowseView] = useState<BrowseView>("overview")
  const [editorTool, setEditorTool] = useState<string | null>(null)
  const [liveJoin, setLiveJoin] = useState<{ assignmentId: string; nonce: number } | null>(null)
  const [editorInstanceKey, setEditorInstanceKey] = useState("editor")
  const [coraDrawerOpen, setCoraDrawerOpen] = useState(false)
  const pullStartY = useRef<number | null>(null)
  const { sessions: liveSessions, listSupported, loading: liveSessionsLoading } = useStudentLiveClassroomSessions(studentId)
  const liveJoinGraceUntilRef = useRef(0)
  const liveMissCountRef = useRef(0)
  const markLiveJoinGrace = useCallback(() => {
    liveJoinGraceUntilRef.current = Date.now() + LIVE_JOIN_GRACE_MS
    liveMissCountRef.current = 0
  }, [])

  useEffect(() => {
    try {
      const browse = sessionStorage.getItem("codebench_hub_browse") as BrowseView | null
      const tool = sessionStorage.getItem("codebench_hub_tool")
      if (browse === "editor" || browse === "overview" || browse === "challenge" || browse === "tools" || browse === "badges" || browse === "leaderboard" || browse === "streak" || browse === "analytics") {
        sessionStorage.removeItem("codebench_hub_browse")
        if (browse === "editor") {
          setEditorTool(tool)
          setBrowseView("editor")
        } else {
          setBrowseView(browse)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const openHub = (event: Event) => {
      event.preventDefault()
      setEditorTool(null)
      setBrowseView("overview")
    }
    window.addEventListener("codebench-open-hub", openHub)
    return () => window.removeEventListener("codebench-open-hub", openHub)
  }, [])

  useEffect(() => {
    const onJoin = (event: Event) => {
      const assignmentId = String(
        (event as CustomEvent<{ assignmentId?: string | number }>).detail?.assignmentId ?? "",
      ).trim()
      if (!assignmentId) return
      markLiveJoinGrace()
      setLiveJoin((current) =>
        current?.assignmentId === assignmentId ? current : { assignmentId, nonce: Date.now() },
      )
    }
    const onLeave = () => setLiveJoin(null)
    window.addEventListener("codebench-join-live-session", onJoin)
    window.addEventListener("codebench-leave-live-session", onLeave)
    return () => {
      window.removeEventListener("codebench-join-live-session", onJoin)
      window.removeEventListener("codebench-leave-live-session", onLeave)
    }
  }, [markLiveJoinGrace])

  useEffect(() => {
    const result = shouldTreatLiveSessionAsEnded({
      isJoined: Boolean(liveJoin),
      listSupported,
      loading: liveSessionsLoading,
      joinGraceUntilMs: liveJoinGraceUntilRef.current,
      assignmentId: liveJoin?.assignmentId,
      sessions: liveSessions,
      missCount: liveMissCountRef.current,
    })
    liveMissCountRef.current = result.nextMissCount
    if (!result.ended || !liveJoin) return
    const assignmentId = liveJoin.assignmentId
    setLiveJoin(null)
    window.dispatchEvent(
      new CustomEvent("codebench-leave-live-session", { detail: { assignmentId } }),
    )
  }, [liveJoin, liveSessions, liveSessionsLoading, listSupported])

  const loadDailyChallenge = useCallback(async (studentIdValue: string) => {
    setChallengeLoading(true)
    const today = new Date().toISOString().split("T")[0]
    const savedChallenge = localStorage.getItem(`codebench_challenge_${today}`)
    let challengeCompleted = false
    if (savedChallenge) {
      try {
        challengeCompleted = Boolean(JSON.parse(savedChallenge).completed)
      } catch {
        challengeCompleted = false
      }
    }

    try {
      const challengeRes = await fetch("/api/codebench/daily-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentIdValue,
          code: resolveCodebenchEditorCode(readStoredCodebenchLanguageId()),
          learningMode: localStorage.getItem("codebench_learning_mode") || "intermediate",
        }),
      })
      if (!challengeRes.ok) return

      const data = await challengeRes.json()
      const title = String(data.title || data.challenge?.title || "").trim()
      const description = String(data.description || data.challenge?.description || "").trim()
      let challenge: CodebenchChallengeHandoff | null = null
      if (title && description) {
        challenge = {
          id: String(data.id || data.challenge?.id || `challenge_${today}`),
          title,
          description,
          difficulty: String(data.difficulty || "Medium"),
          xpReward: Number(data.xpReward ?? 10) || 10,
          completed: challengeCompleted,
          date: String(data.date || today),
        }
      } else if (title) {
        challenge = {
          id: String(data.id || `challenge_${today}`),
          title,
          description: `## Problem\n\n${title}\n\nOpen the workspace to load the full prompt from Cora.`,
          difficulty: String(data.difficulty || "Medium"),
          xpReward: Number(data.xpReward ?? 10) || 10,
          completed: challengeCompleted,
          date: String(data.date || today),
        }
      }
      if (challenge) {
        setStats((prev) => {
          const next = { ...prev, challenge }
          writeCachedHubStats(next)
          return next
        })
      }
    } catch {
      // optional enrichment
    } finally {
      setChallengeLoading(false)
    }
  }, [])

  const loadHub = useCallback(async (studentIdValue: string) => {
    const xp = getCurrentXP()
    const [streakRes, badgesRes, leaderboardRes] = await Promise.all([
      fetch(`/api/codebench/streak?studentId=${studentIdValue}`),
      fetch(`/api/codebench/badges?studentId=${studentIdValue}`),
      fetch(`/api/codebench/leaderboard?studentId=${studentIdValue}`),
    ])

    let streakDays = 0
    if (streakRes.ok) {
      const data = await streakRes.json()
      streakDays = data.streakDays || 0
    }

    let badgeCount = 0
    let topBadges: HubStats["topBadges"] = []
    if (badgesRes.ok) {
      const data = await badgesRes.json()
      const details = data.badgeDetails || {}
      topBadges = Object.entries(details)
        .slice(0, 6)
        .map(([id, detail]) => {
          const d = detail as { name: string; icon: string }
          return { id, name: d.name, icon: d.icon || "🏅" }
        })
      badgeCount = Object.keys(details).length
    }

    let rank: number | null = null
    let leaderboardPreview: HubStats["leaderboardPreview"] = []
    if (leaderboardRes.ok) {
      const data = await leaderboardRes.json()
      const rows = (data.leaderboard || []) as Array<{
        rank: number
        student_name: string
        xp: number
        student_code?: string
      }>
      leaderboardPreview = rows.slice(0, 5).map((row) => ({
        rank: row.rank,
        student_name: row.student_name,
        xp: row.xp,
      }))
      const selfRow = rows.find(
        (row) =>
          row.student_code === sessionStorage.getItem("studentId") ||
          String(row.rank) === String(data.currentRank),
      )
      rank = selfRow?.rank ?? data.currentRank ?? null
    }

    const nextStats: HubStats = {
      streakDays,
      badgeCount,
      xp,
      rank,
      challenge: null,
      topBadges,
      leaderboardPreview,
    }
    setStats((prev) => {
      const merged = { ...nextStats, challenge: prev.challenge }
      writeCachedHubStats(merged)
      return merged
    })
    setStatsLoading(false)
    void loadDailyChallenge(studentIdValue)
  }, [loadDailyChallenge])

  useEffect(() => {
    const id = studentId ?? resolveStudentDatabaseId()
    if (!id) {
      router.push("/student/login")
      return
    }
    if (!studentId) setStudentId(id)

    void (async () => {
      try {
        const membershipRes = await studentApiFetch(`/api/student/membership?studentId=${id}`)
        if (membershipRes.ok) {
          const data = await membershipRes.json()
          setTier((data.membership?.tier || "Scholar") as MembershipTier)
        }
      } catch {
        // non-blocking
      }
      await loadHub(id)
    })()

    const onXp = (event: Event) => {
      const detail = (event as CustomEvent<{ xp: number }>).detail
      if (detail?.xp != null) {
        setStats((prev) => ({ ...prev, xp: detail.xp }))
      }
    }
    window.addEventListener("codebench-xp-updated", onXp)
    return () => window.removeEventListener("codebench-xp-updated", onXp)
  }, [loadHub, router, studentId])

  const handleRefresh = async () => {
    if (!studentId) return
    setRefreshing(true)
    setStatsLoading(true)
    setChallengeLoading(true)
    try {
      await loadHub(studentId)
    } finally {
      setRefreshing(false)
    }
  }

  const browseItems = useMemo(
    () => [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "editor", label: "Editor", icon: Code2, badge: liveSessions.length || undefined },
      { id: "challenge", label: "Daily challenge", icon: Target },
      { id: "tools", label: "Cora tools", icon: Sparkles, badge: CODEBENCH_CORA_TOOLS.length },
      { id: "badges", label: "Badges", icon: Award, badge: stats.badgeCount || undefined },
      { id: "leaderboard", label: "Leaderboard", icon: Trophy },
      { id: "streak", label: "Streak", icon: Flame, badge: stats.streakDays || undefined },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
    ],
    [liveSessions.length, stats.badgeCount, stats.streakDays],
  )

  const browseMenu = (
    <FacultyModuleSideMenu
      embedded
      className="lg:border-r lg:border-[var(--border)] lg:pr-4"
      moduleId={MODULE_ID}
      accent={isDark ? "theme" : { soft: roles.browse.soft, ink: roles.browse.ink }}
      title="Browse"
      activeId={browseView}
      onSelect={(id) => {
        if (id === "editor") setEditorTool(null)
        setBrowseView(id as BrowseView)
      }}
      items={browseItems}
    />
  )

  const isEditorView = browseView === "editor"
  const hubOuterClass = isEditorView
    ? "flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3"
    : "flex min-h-0 flex-1 flex-col overflow-hidden min-w-0"
  const hubScrollClass =
    "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain min-w-0"
  const hubContentClass = "min-w-0 space-y-4 p-4 sm:space-y-5 sm:p-5"
  const splitLayoutClass = cn(
    "gap-2 sm:gap-3 lg:gap-4",
    isEditorView ? "flex min-h-0 flex-1 flex-col" : "lg:min-h-[min(560px,65vh)]",
  )
  const splitContentClass = cn("min-w-0", isEditorView && "flex min-h-0 flex-1 flex-col")

  const kpiStats = [
    {
      label: "Streak",
      value: stats.streakDays,
      icon: Flame,
      thumbIndex: 0,
      footer: stats.streakDays === 1 ? "Day active" : "Days active",
    },
    {
      label: "Badges",
      value: stats.badgeCount,
      icon: Award,
      thumbIndex: 1,
      footer: stats.badgeCount === 1 ? "Badge earned" : "Badges earned",
    },
    {
      label: "XP",
      value: stats.xp.toLocaleString(),
      icon: Zap,
      thumbIndex: 2,
      footer: "CodeBench XP",
    },
    {
      label: "Rank",
      value: stats.rank != null ? `#${stats.rank}` : "—",
      icon: Trophy,
      thumbIndex: 3,
      footer: stats.rank != null ? "Class rank" : "Not ranked yet",
    },
  ]

  const openInlineEditor = (tool?: string | null) => {
    setEditorTool(tool ?? null)
    if (!liveJoin) setEditorInstanceKey(tool || "editor")
    setBrowseView("editor")
  }

  const joinLiveSession = (session: StudentLiveClassroomSession) => {
    const assignmentId = String(session.assignmentId)
    markLiveJoinGrace()
    setLiveJoin((current) =>
      current?.assignmentId === assignmentId ? current : { assignmentId, nonce: Date.now() },
    )
    setEditorInstanceKey((current) =>
      current === `live-${assignmentId}` ? current : `live-${assignmentId}`,
    )
    setEditorTool(null)
    setBrowseView("editor")
    window.dispatchEvent(
      new CustomEvent("codebench-join-live-session", { detail: { assignmentId } }),
    )
  }

  const leaveLiveSession = (session: StudentLiveClassroomSession) => {
    setLiveJoin(null)
    window.dispatchEvent(
      new CustomEvent("codebench-leave-live-session", {
        detail: { assignmentId: String(session.assignmentId) },
      }),
    )
  }

  const editorPane = (
    <CodebenchInlineEditor
      key={editorInstanceKey}
      initialTool={editorTool}
      initialAssignmentId={liveJoin?.assignmentId ?? null}
      className="h-full min-h-[min(520px,calc(100dvh-14rem))] flex-1 lg:min-h-0"
    />
  )

  const editorHero = (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl px-5 py-6 sm:px-6 sm:py-7",
        isDark
          ? "border border-[color-mix(in_srgb,var(--cc-accent)_18%,var(--border))] bg-[var(--card)]"
          : "border border-transparent",
      )}
      style={isDark ? undefined : { background: soft }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: isDark ? 1 : 0.45,
          background: isDark
            ? `radial-gradient(ellipse at top right, color-mix(in srgb, ${accent} 14%, transparent), transparent 58%)`
            : `radial-gradient(ellipse at top right, ${accent}33, transparent 55%)`,
        }}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-semibold" style={{ color: accent }}>
            <SolidListThumbTile thumb={roles.hero} icon={Sparkles} size="compact" />
            Student workspace
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--cc-text)]">Editor</h2>
          <p className="max-w-lg text-sm text-[var(--cc-text-muted)]">
            Monaco IDE and Cora tools open inline here — expand when you need more room.
          </p>
        </div>
        <Button
          size="lg"
          className="h-11 shrink-0 gap-2 rounded-xl border-0 px-5 shadow-sm hover:opacity-90"
          style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
          onClick={() => openInlineEditor()}
        >
          <Code2 className="h-5 w-5" />
          Open editor
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  const openChallengeSolve = () => {
    if (stats.challenge) {
      setCodebenchChallengeHandoff({ ...stats.challenge, intent: "solve" })
    }
    openInlineEditor()
  }

  const openChallengeCora = () => {
    if (!hasCora) {
      coraGate.requestCoraAction("Ask Cora", () => {})
      return
    }
    setCoraDrawerOpen(true)
  }

  const challengePanel = (
    <DailyChallengeCard
      challenge={stats.challenge}
      loading={challengeLoading && !stats.challenge}
      onSolve={openChallengeSolve}
      onAskCora={openChallengeCora}
    />
  )

  const toolsPanel = (
    <CodebenchCoraToolsStudio studentId={studentId} coraAccess={hasCora} onLockedCora={coraGate.requestCoraAction} />
  )

  const badgesPanel = <BadgesTab embedInDashboard />
  const leaderboardPanel = <LeaderboardTab embedInDashboard />
  const streakPanel = <StreakTab embedInDashboard />
  const analyticsPanel = studentId ? (
    <AnalyticsTab
      studentId={studentId}
      embedInDashboard
      onOpenEditor={() => {
        setEditorTool(null)
        setBrowseView("editor")
      }}
    />
  ) : null

  let detail: ReactNode
  switch (browseView) {
    case "editor":
      detail = editorPane
      break
    case "challenge":
      detail = challengePanel
      break
    case "tools":
      detail = toolsPanel
      break
    case "badges":
      detail = badgesPanel
      break
    case "leaderboard":
      detail = leaderboardPanel
      break
    case "streak":
      detail = streakPanel
      break
    case "analytics":
      detail = analyticsPanel
      break
    default:
      detail = (
        <div className="space-y-5">
          <StudentLiveClassroomBanner
            sessions={liveSessions}
            activeAssignmentId={liveJoin?.assignmentId ?? null}
            onJoin={joinLiveSession}
            onLeave={leaveLiveSession}
          />
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 pt-3 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-5">
            {statsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 opacity-70" aria-hidden>
                    <div className="h-9 w-9 animate-pulse rounded-lg bg-[var(--muted)]" />
                    <div className="h-6 w-10 animate-pulse rounded bg-[var(--muted)]" />
                    <div className="h-2.5 w-14 animate-pulse rounded bg-[var(--muted)]" />
                  </div>
                ))
              : kpiStats.map((stat) => (
                  <CodebenchStatCell
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    icon={stat.icon}
                    thumbIndex={stat.thumbIndex}
                    footer={stat.footer}
                  />
                ))}
          </div>
          {studentId ? (
            <CodebenchStudioCoach
              studentId={studentId}
              variant="card"
              onOpenEditor={() => openInlineEditor()}
              onSeeDetails={() => setBrowseView("analytics")}
            />
          ) : null}
          {editorHero}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            {challengePanel}
            <div className={cn("flex flex-col justify-between gap-4 p-5", CODEBENCH_PANEL)}>
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <SolidListThumbTile thumb={roles.tool} icon={Sparkles} size="compact" />
                  <h3 className="font-semibold text-[var(--cc-text)]">Cora Studio tools</h3>
                </div>
                <p className="text-sm text-[var(--cc-text-muted)]">
                  Ask Cora, debug, improve, practice, and evaluate — each opens in a right-side drawer like AI Tutor.
                </p>
              </div>
              <Button
                className="h-11 w-full gap-2 rounded-xl border-0 shadow-sm hover:opacity-90 sm:w-auto"
                style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
                onClick={() => setBrowseView("tools")}
              >
                <Sparkles className="h-4 w-4" />
                Browse Cora tools
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )
  }

  const hubSplit = (
    <FacultyModuleSplitLayout
      className={splitLayoutClass}
      scrollMode={isEditorView ? "panel" : "page"}
      menuWidthClass="lg:w-52"
      menu={browseMenu}
    >
      <div className={splitContentClass}>{detail}</div>
    </FacultyModuleSplitLayout>
  )

  return (
    <div className={hubOuterClass}>
      {isEditorView ? (
        hubSplit
      ) : (
        <div
          className={hubScrollClass}
          onTouchStart={(event) => {
            if (typeof window !== "undefined" && window.scrollY <= 4) {
              pullStartY.current = event.touches[0]?.clientY ?? null
            } else {
              pullStartY.current = null
            }
          }}
          onTouchEnd={(event) => {
            const start = pullStartY.current
            pullStartY.current = null
            if (start == null || refreshing) return
            const end = event.changedTouches[0]?.clientY ?? start
            if (end - start > 70) void handleRefresh()
          }}
        >
          <div className={hubContentClass}>{hubSplit}</div>
        </div>
      )}

      {stats.challenge ? (
        <CodebenchChallengeCoraDrawer
          open={coraDrawerOpen}
          onClose={() => setCoraDrawerOpen(false)}
          challenge={stats.challenge}
          studentId={studentId}
          mode="challenge"
          coraAccess={hasCora}
          onLockedCora={(label) => coraGate.requestCoraAction(label, () => {})}
        />
      ) : null}

      <CodebenchCoraUpgradeModal
        open={coraGate.upgradeOpen}
        onClose={coraGate.closeUpgrade}
        actionLabel={coraGate.actionLabel}
      />
    </div>
  )
}
