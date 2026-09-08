"use client"

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
  Crown,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { ThemeKpiCard } from "@/components/student/dashboard-v2/ThemeKpiCard"
import { CODEBENCH_PANEL } from "@/lib/codebench/codebench-surface-classes"
import { EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
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
import { BadgesTab } from "@/components/codebench/MoreMenu/BadgesTab"
import { LeaderboardTab } from "@/components/codebench/MoreMenu/LeaderboardTab"
import { StreakTab } from "@/components/codebench/MoreMenu/StreakTab"
import { AnalyticsTab } from "@/components/codebench/MoreMenu/AnalyticsTab"
import { CodebenchStudioCoach } from "@/components/codebench/CodebenchStudioCoach"
import { DailyChallengeCard } from "@/components/codebench/DailyChallengeCard"
import { CodebenchInlineEditor } from "@/components/codebench/CodebenchInlineEditor"
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
  CodebenchChallengeSkeleton,
  CodebenchOverviewSkeleton,
} from "@/components/codebench/CodebenchSkeletons"

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

const EMPTY_STATS: HubStats = {
  streakDays: 0,
  badgeCount: 0,
  xp: 0,
  rank: null,
  challenge: null,
  topBadges: [],
  leaderboardPreview: [],
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
  const [studentId, setStudentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState<HubStats>(EMPTY_STATS)
  const [tier, setTier] = useState<MembershipTier | null>(null)
  const [browseView, setBrowseView] = useState<BrowseView>("overview")
  const [editorTool, setEditorTool] = useState<string | null>(null)
  const [coraDrawerOpen, setCoraDrawerOpen] = useState(false)
  const pullStartY = useRef<number | null>(null)

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

  const loadHub = useCallback(async (studentIdValue: string) => {
    const xp = getCurrentXP()
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

    const [streakRes, badgesRes, leaderboardRes, challengeRes] = await Promise.all([
      fetch(`/api/codebench/streak?studentId=${studentIdValue}`),
      fetch(`/api/codebench/badges?studentId=${studentIdValue}`),
      fetch(`/api/codebench/leaderboard?studentId=${studentIdValue}`),
      fetch("/api/codebench/daily-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentIdValue,
          code: resolveCodebenchEditorCode(readStoredCodebenchLanguageId()),
          learningMode: localStorage.getItem("codebench_learning_mode") || "intermediate",
        }),
      }).catch(() => null),
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

    let challenge: CodebenchChallengeHandoff | null = null
    if (challengeRes && "ok" in challengeRes && challengeRes.ok) {
      const data = await challengeRes.json()
      const title = String(data.title || data.challenge?.title || "").trim()
      const description = String(data.description || data.challenge?.description || "").trim()
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
    }

    setStats({
      streakDays,
      badgeCount,
      xp,
      rank,
      challenge,
      topBadges,
      leaderboardPreview,
    })
  }, [])

  useEffect(() => {
    const id = resolveStudentDatabaseId()
    if (!id) {
      router.push("/student/login")
      return
    }
    setStudentId(id)
    void (async () => {
      try {
        const membershipRes = await studentApiFetch(`/api/student/membership?studentId=${id}`)
        if (membershipRes.ok) {
          const data = await membershipRes.json()
          const nextTier = (data.membership?.tier || "Scholar") as MembershipTier
          setTier(nextTier)
          if (nextTier !== "Trailblazer") {
            setLoading(false)
            return
          }
        }
      } catch {
        // fall through
      }
      await loadHub(id)
      setLoading(false)
    })()

    const onXp = (event: Event) => {
      const detail = (event as CustomEvent<{ xp: number }>).detail
      if (detail?.xp != null) {
        setStats((prev) => ({ ...prev, xp: detail.xp }))
      }
    }
    window.addEventListener("codebench-xp-updated", onXp)
    return () => window.removeEventListener("codebench-xp-updated", onXp)
  }, [loadHub, router])

  const handleRefresh = async () => {
    if (!studentId || tier !== "Trailblazer") return
    setRefreshing(true)
    try {
      await loadHub(studentId)
    } finally {
      setRefreshing(false)
    }
  }

  const browseItems = useMemo(
    () => [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "editor", label: "Editor", icon: Code2 },
      { id: "challenge", label: "Daily challenge", icon: Target },
      { id: "tools", label: "Cora tools", icon: Sparkles, badge: CODEBENCH_CORA_TOOLS.length },
      { id: "badges", label: "Badges", icon: Award, badge: stats.badgeCount || undefined },
      { id: "leaderboard", label: "Leaderboard", icon: Trophy },
      { id: "streak", label: "Streak", icon: Flame, badge: stats.streakDays || undefined },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
    ],
    [stats.badgeCount, stats.streakDays],
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

  if (loading) {
    const loadingSplit = (
      <FacultyModuleSplitLayout
        className={splitLayoutClass}
        scrollMode={isEditorView ? "panel" : "page"}
        menuWidthClass="lg:w-52"
        menu={browseMenu}
      >
        <div className={splitContentClass}>
          {browseView === "editor" ? (
            <CodebenchInlineEditor
              key={editorTool || "editor"}
              initialTool={editorTool}
              className="h-full min-h-0 flex-1"
            />
          ) : browseView === "tools" ? (
            <CodebenchCoraToolsStudio studentId={studentId} />
          ) : browseView === "badges" ? (
            <BadgesTab embedInDashboard />
          ) : browseView === "leaderboard" ? (
            <LeaderboardTab embedInDashboard />
          ) : browseView === "streak" ? (
            <StreakTab embedInDashboard />
          ) : browseView === "analytics" ? (
            studentId ? (
              <AnalyticsTab
                studentId={studentId}
                embedInDashboard
                onOpenEditor={() => {
                  setEditorTool(null)
                  setBrowseView("editor")
                }}
              />
            ) : (
              <CodebenchAnalyticsSkeleton />
            )
          ) : browseView === "challenge" ? (
            <CodebenchChallengeSkeleton />
          ) : (
            <CodebenchOverviewSkeleton />
          )}
        </div>
      </FacultyModuleSplitLayout>
    )

    return (
      <div className={hubOuterClass}>
        {isEditorView ? (
          loadingSplit
        ) : (
          <div className={hubScrollClass}>
            <div className={hubContentClass}>{loadingSplit}</div>
          </div>
        )}
      </div>
    )
  }

  if (tier && tier !== "Trailblazer") {
    return (
      <div className={cn("flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:p-5", EMBED_MATERIAL_PANEL)}>
        <SolidListThumbTile thumb={roles.hero} icon={Crown} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[var(--cc-text)]">Trailblazer required</h3>
          <p className="mt-0.5 text-sm text-[var(--cc-text-muted)]">
            CodeBench hub, IDE, and Cora coding tools unlock with Trailblazer membership.
          </p>
        </div>
        <Button
          className="shrink-0 rounded-xl border-0 shadow-sm hover:opacity-90"
          style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
          asChild
        >
          <Link href="/student/dashboard-v2/membership">View plans</Link>
        </Button>
      </div>
    )
  }

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
    setBrowseView("editor")
  }

  const editorPane = (
    <CodebenchInlineEditor
      key={editorTool || "editor"}
      initialTool={editorTool}
      className="h-full min-h-0 flex-1"
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
            Trailblazer workspace
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
    setCoraDrawerOpen(true)
  }

  const challengePanel = (
    <DailyChallengeCard
      challenge={stats.challenge}
      onSolve={openChallengeSolve}
      onAskCora={openChallengeCora}
    />
  )

  const toolsPanel = (
    <CodebenchCoraToolsStudio studentId={studentId} />
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
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 pt-3 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-5">
            {kpiStats.map((stat) => (
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
        />
      ) : null}
    </div>
  )
}
