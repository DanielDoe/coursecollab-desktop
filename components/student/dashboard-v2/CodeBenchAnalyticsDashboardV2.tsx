"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "@/components/student/dashboard-v2/light-motion"
import {
  User,
  BarChart3,
  Award,
  Target,
  Trophy,
  Flame,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardWrapper } from "./CardWrapper"
import { ProfileTab } from "@/components/codebench/MoreMenu/ProfileTab"
import { AnalyticsTab } from "@/components/codebench/MoreMenu/AnalyticsTab"
import { BadgesTab } from "@/components/codebench/MoreMenu/BadgesTab"
import { DailyChallengeTab } from "@/components/codebench/MoreMenu/DailyChallengeTab"
import { LeaderboardTab } from "@/components/codebench/MoreMenu/LeaderboardTab"
import { StreakTab } from "@/components/codebench/MoreMenu/StreakTab"
import { ProgressSummarySection } from "@/components/codebench/MoreMenu/ProgressSummarySection"
import { resolveStudentDatabaseId } from "@/lib/auth"
import { resolveCodebenchEditorCode, readStoredCodebenchLanguageId } from "@/lib/codebench-languages"
import {
  fetchCodebenchProgressSummary,
  invalidateCodebenchProgressCache,
  type CodebenchProgressSummary,
} from "@/lib/codebench-progress"
import {
  PORTAL_NAV_ICON_ACTIVE,
  PORTAL_NAV_ICON_IDLE,
  PORTAL_NAV_LINK_ACTIVE,
  PORTAL_NAV_LINK_IDLE,
} from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const TAB_ITEMS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "badges", label: "Badges", icon: Award },
  { id: "challenge", label: "Daily Challenge", icon: Target },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "streak", label: "Streak", icon: Flame },
] as const

export function CodeBenchAnalyticsDashboardV2() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [activeTab, setActiveTab] = useState<(typeof TAB_ITEMS)[number]["id"]>("profile")
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [progressSummary, setProgressSummary] = useState<CodebenchProgressSummary | null>(null)
  const [progressLoading, setProgressLoading] = useState(true)
  const pullStartY = useRef<number | null>(null)

  const loadProgress = async (studentDatabaseId: string, force = false) => {
    setProgressLoading(true)
    try {
      const editorCode = resolveCodebenchEditorCode(readStoredCodebenchLanguageId())
      const summary = await fetchCodebenchProgressSummary(studentDatabaseId, {
        editorCode,
        force,
      })
      setProgressSummary(summary)
      setCode(summary.analyzeCode)
    } finally {
      setProgressLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCode(resolveCodebenchEditorCode(readStoredCodebenchLanguageId()))

      const studentDatabaseId = resolveStudentDatabaseId()
      if (!studentDatabaseId) {
        router.push("/student/login")
        return
      }
      setStudentId(studentDatabaseId)
      void loadProgress(studentDatabaseId)
    }
  }, [router])

  useEffect(() => {
    if (!studentId) return
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadProgress(studentId)
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [studentId])

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && TAB_ITEMS.some((t) => t.id === tab)) {
      setActiveTab(tab as (typeof TAB_ITEMS)[number]["id"])
    }
  }, [searchParams])

  const setTab = (id: string) => {
    setActiveTab(id as (typeof TAB_ITEMS)[number]["id"])
    router.replace(`/student/dashboard-v2/codebench/more?tab=${id}`, { scroll: false })
  }

  const handleRefresh = async () => {
    if (!studentId) return
    setRefreshing(true)
    invalidateCodebenchProgressCache()
    await loadProgress(studentId, true)
    setRefreshKey((k) => k + 1)
    setRefreshing(false)
  }

  if (!studentId) {
    return (
      <CardWrapper delay={0} hover={false}>
        <div className="min-h-[300px] flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent"
            />
            <p className="text-slate-500 dark:text-slate-400">Loading...</p>
          </div>
        </div>
      </CardWrapper>
    )
  }

  return (
    <div
      className="space-y-4"
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--cc-text)] sm:text-2xl">Analytics & More</h1>
          <p className="mt-0.5 text-sm text-[var(--cc-text-muted)]">Profile, badges, streak, and leaderboard</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-full"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
      {/* Side nav — appearance-themed */}
      <nav
        className="flex shrink-0 flex-col gap-0.5 lg:w-52 xl:w-56 lg:sticky lg:top-4 lg:border-l-2 lg:border-[var(--cc-drawer-soft-border)] lg:pl-3"
        aria-label="CodeBench sections"
      >
        {TAB_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-all duration-300 min-h-[44px] sm:min-h-0",
                isActive ? PORTAL_NAV_LINK_ACTIVE : PORTAL_NAV_LINK_IDLE,
              )}
            >
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-xl shrink-0 transition-all duration-300",
                  isActive ? PORTAL_NAV_ICON_ACTIVE : PORTAL_NAV_ICON_IDLE,
                  !isActive && "opacity-90",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTab}-${refreshKey}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="min-w-0"
          >
            <CardWrapper delay={0.04} hover={false} variant="embed">
              <div className="p-4 sm:p-6">
                <ProgressSummarySection
                  summary={progressSummary}
                  loading={progressLoading}
                  embedInDashboard
                />
                {activeTab === "profile" && (
                  <ProfileTab
                    code={progressSummary?.analyzeCode ?? code}
                    studentId={studentId}
                    embedInDashboard
                    refreshKey={refreshKey}
                  />
                )}
                {activeTab === "analytics" && (
                  <AnalyticsTab
                    code={progressSummary?.analyzeCode ?? code}
                    studentId={studentId}
                    embedInDashboard
                    refreshKey={refreshKey}
                  />
                )}
                {activeTab === "badges" && <BadgesTab embedInDashboard />}
                {activeTab === "challenge" && (
                  <DailyChallengeTab
                    code={progressSummary?.analyzeCode ?? code}
                    studentId={studentId}
                    embedInDashboard
                    onXpEarned={(amount) => {
                      if (typeof window === "undefined") return
                      const next = Number(localStorage.getItem("codebench_xp") || "0") + amount
                      localStorage.setItem("codebench_xp", next.toString())
                      window.dispatchEvent(new CustomEvent("codebench-xp-updated", { detail: { xp: next } }))
                    }}
                  />
                )}
                {activeTab === "leaderboard" && <LeaderboardTab embedInDashboard />}
                {activeTab === "streak" && <StreakTab embedInDashboard />}
              </div>
            </CardWrapper>
          </motion.div>
        </AnimatePresence>
      </div>
      </div>
    </div>
  )
}
