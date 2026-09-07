"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, User, BarChart3, Award, Target, Trophy, Flame } from "lucide-react"
import Link from "next/link"
import { GraduationCap } from "lucide-react"
import { NotificationBell } from "@/components/notification-bell"
import { StudentProfileDropdown } from "@/components/student-profile-dropdown"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProfileTab } from "@/components/codebench/MoreMenu/ProfileTab"
import { AnalyticsTab } from "@/components/codebench/MoreMenu/AnalyticsTab"
import { BadgesTab } from "@/components/codebench/MoreMenu/BadgesTab"
import { DailyChallengeTab } from "@/components/codebench/MoreMenu/DailyChallengeTab"
import { LeaderboardTab } from "@/components/codebench/MoreMenu/LeaderboardTab"
import { StreakTab } from "@/components/codebench/MoreMenu/StreakTab"
import { XPTracker } from "@/components/codebench/MoreMenu/XPTracker"
import { getCurrentXP } from "@/lib/codebench-xp"
import { cn } from "@/lib/utils"
import { CodebenchPaneSkeleton, type CodebenchBrowseView } from "@/components/codebench/CodebenchSkeletons"

export default function CodeBenchMorePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [activeTab, setActiveTab] = useState("profile")
  const [xp, setXp] = useState(0)

  // Get code from localStorage (not URL)
  useEffect(() => {
    // Always get code from localStorage
    if (typeof window !== "undefined") {
      const savedCode = localStorage.getItem("codebench_last_code")
      if (savedCode) {
        setCode(savedCode)
      }
    }

    const studentDatabaseId = sessionStorage.getItem("studentDatabaseId")
    if (!studentDatabaseId) {
      router.push("/student/login")
      return
    }
    setStudentId(studentDatabaseId)

    // Load XP
    if (typeof window !== "undefined") {
      const currentXp = getCurrentXP()
      setXp(currentXp)
      
      // Listen for XP updates
      const handleXPUpdate = (e: CustomEvent) => {
        setXp(e.detail.xp)
      }
      window.addEventListener("codebench-xp-updated", handleXPUpdate as EventListener)
      
      return () => {
        window.removeEventListener("codebench-xp-updated", handleXPUpdate as EventListener)
      }
    }

    // Set initial tab from URL
    const tab = searchParams.get("tab")
    if (tab) {
      setActiveTab(tab)
    }
  }, [router, searchParams])

  if (!studentId) {
    const tab = searchParams.get("tab") || "profile"
    const view: CodebenchBrowseView =
      tab === "badges"
        ? "badges"
        : tab === "leaderboard"
          ? "leaderboard"
          : tab === "streak"
            ? "streak"
            : tab === "challenge"
              ? "challenge"
              : "analytics"
    return (
      <div className="min-h-screen p-4 sm:p-6">
        <CodebenchPaneSkeleton view={view} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-800/95 to-slate-700/95 backdrop-blur-xl border-b border-slate-600/30 sticky top-0 z-10 shadow-2xl">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <Link href="/student/dashboard-v2" className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity group shrink-0">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg sm:rounded-xl group-hover:from-blue-500/30 group-hover:to-cyan-500/30 transition-all duration-300 shrink-0">
                <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
              </div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                CourseCollab
              </h1>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
              <NotificationBell />
              <StudentProfileDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2 sm:mb-3">
                <span className="sm:hidden">Analytics</span>
                <span className="hidden sm:inline">CodeBench Analytics</span>
              </h1>
              <p className="text-slate-300 dark:text-slate-400 text-sm sm:text-base md:text-lg">
                <span className="sm:hidden">Track progress</span>
                <span className="hidden sm:inline">Track your coding progress and achievements</span>
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <XPTracker xp={xp} />
              <Link href="/student/codebench" className="flex-1 sm:flex-none">
                <button className="w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm md:text-base border border-blue-500/50 dark:border-blue-500/60 text-blue-300 dark:text-blue-400 hover:bg-blue-500/20 dark:hover:bg-blue-500/30 hover:border-blue-400 dark:hover:border-blue-400 hover:text-blue-200 dark:hover:text-blue-300 transition-all duration-300 bg-blue-500/10 dark:bg-blue-500/20 backdrop-blur-sm rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 font-medium">
                  <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span className="hidden sm:inline">Back to CodeBench</span>
                  <span className="sm:hidden">Back</span>
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Main Layout with Side Menu */}
        <div className="grid lg:grid-cols-[280px_1fr] gap-4 sm:gap-6">
          {/* Side Menu */}
          <Card className="h-fit sticky top-4 border-slate-700/50 dark:border-slate-700/60 shadow-xl bg-slate-800/90 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl sm:rounded-2xl order-2 lg:order-1">
            <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg font-semibold text-slate-200 dark:text-slate-100">
                <span className="sm:hidden">Menu</span>
                <span className="hidden sm:inline">Analytics Menu</span>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-slate-400 dark:text-slate-500">
                <span className="sm:hidden">Select module</span>
                <span className="hidden sm:inline">Select a module</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5 sm:space-y-2 p-4 sm:p-6 pt-0">
              <Button
                variant={activeTab === "profile" ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-2 sm:gap-3 h-10 sm:h-12 rounded-lg sm:rounded-xl transition-all text-xs sm:text-sm md:text-base",
                  activeTab === "profile"
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-700 dark:to-cyan-700 text-white shadow-lg hover:from-blue-700 hover:to-cyan-700 dark:hover:from-blue-800 dark:hover:to-cyan-800"
                    : "text-slate-300 dark:text-slate-400 hover:bg-slate-700/50 dark:hover:bg-slate-700/70 hover:text-white dark:hover:text-white"
                )}
                onClick={() => setActiveTab("profile")}
              >
                <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                Profile
              </Button>
              <Button
                variant={activeTab === "analytics" ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-2 sm:gap-3 h-10 sm:h-12 rounded-lg sm:rounded-xl transition-all text-xs sm:text-sm md:text-base",
                  activeTab === "analytics"
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-700 dark:to-cyan-700 text-white shadow-lg hover:from-blue-700 hover:to-cyan-700 dark:hover:from-blue-800 dark:hover:to-cyan-800"
                    : "text-slate-300 dark:text-slate-400 hover:bg-slate-700/50 dark:hover:bg-slate-700/70 hover:text-white dark:hover:text-white"
                )}
                onClick={() => setActiveTab("analytics")}
              >
                <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                Analytics
              </Button>
              <Button
                variant={activeTab === "badges" ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-2 sm:gap-3 h-10 sm:h-12 rounded-lg sm:rounded-xl transition-all text-xs sm:text-sm md:text-base",
                  activeTab === "badges"
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-700 dark:to-cyan-700 text-white shadow-lg hover:from-blue-700 hover:to-cyan-700 dark:hover:from-blue-800 dark:hover:to-cyan-800"
                    : "text-slate-300 dark:text-slate-400 hover:bg-slate-700/50 dark:hover:bg-slate-700/70 hover:text-white dark:hover:text-white"
                )}
                onClick={() => setActiveTab("badges")}
              >
                <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                Badges
              </Button>
              <Button
                variant={activeTab === "challenge" ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-2 sm:gap-3 h-10 sm:h-12 rounded-lg sm:rounded-xl transition-all text-xs sm:text-sm md:text-base",
                  activeTab === "challenge"
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-700 dark:to-cyan-700 text-white shadow-lg hover:from-blue-700 hover:to-cyan-700 dark:hover:from-blue-800 dark:hover:to-cyan-800"
                    : "text-slate-300 dark:text-slate-400 hover:bg-slate-700/50 dark:hover:bg-slate-700/70 hover:text-white dark:hover:text-white"
                )}
                onClick={() => setActiveTab("challenge")}
              >
                <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="sm:hidden">Challenge</span>
                <span className="hidden sm:inline">Daily Challenge</span>
              </Button>
              <Button
                variant={activeTab === "leaderboard" ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-2 sm:gap-3 h-10 sm:h-12 rounded-lg sm:rounded-xl transition-all text-xs sm:text-sm md:text-base",
                  activeTab === "leaderboard"
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-700 dark:to-cyan-700 text-white shadow-lg hover:from-blue-700 hover:to-cyan-700 dark:hover:from-blue-800 dark:hover:to-cyan-800"
                    : "text-slate-300 dark:text-slate-400 hover:bg-slate-700/50 dark:hover:bg-slate-700/70 hover:text-white dark:hover:text-white"
                )}
                onClick={() => setActiveTab("leaderboard")}
              >
                <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                Leaderboard
              </Button>
              <Button
                variant={activeTab === "streak" ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start gap-2 sm:gap-3 h-10 sm:h-12 rounded-lg sm:rounded-xl transition-all text-xs sm:text-sm md:text-base",
                  activeTab === "streak"
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-700 dark:to-cyan-700 text-white shadow-lg hover:from-blue-700 hover:to-cyan-700 dark:hover:from-blue-800 dark:hover:to-cyan-800"
                    : "text-slate-300 dark:text-slate-400 hover:bg-slate-700/50 dark:hover:bg-slate-700/70 hover:text-white dark:hover:text-white"
                )}
                onClick={() => setActiveTab("streak")}
              >
                <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                Streak
              </Button>
            </CardContent>
          </Card>

          {/* Content Area */}
          <div className="min-w-0 order-1 lg:order-2">
            {activeTab === "profile" && <ProfileTab code={code} studentId={studentId} />}
            {activeTab === "analytics" && <AnalyticsTab code={code} studentId={studentId} />}
            {activeTab === "badges" && <BadgesTab />}
            {activeTab === "challenge" && (
              <DailyChallengeTab
                code={code}
                studentId={studentId}
                onXpEarned={(amount) => {
                  setXp((prev) => prev + amount)
                  localStorage.setItem("codebench_xp", (xp + amount).toString())
                }}
              />
            )}
            {activeTab === "leaderboard" && <LeaderboardTab />}
            {activeTab === "streak" && <StreakTab />}
          </div>
        </div>
      </div>
    </div>
  )
}

