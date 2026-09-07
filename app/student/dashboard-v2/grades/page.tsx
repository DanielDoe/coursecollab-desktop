"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { BarChart3, Target, Calculator, Sparkles } from "lucide-react"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { studentModuleSpinnerClass } from "@/lib/student-module-themes"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { cn } from "@/lib/utils"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const GradesOverview = dynamic(
  () => import("@/components/grades-overview").then((m) => ({ default: m.GradesOverview })),
  { loading: () => <ModulePageSkeleton className="min-h-[280px]" /> },
)

const GradesAwaitingReviewBanner = dynamic(
  () =>
    import("@/components/student/dashboard-v2/GradesAwaitingReviewBanner").then((m) => ({
      default: m.GradesAwaitingReviewBanner,
    })),
  { loading: () => null },
)

const GradeBreakdown = dynamic(
  () => import("@/components/grade-breakdown").then((m) => ({ default: m.GradeBreakdown })),
  { loading: () => <ModulePageSkeleton className="min-h-[280px]" /> },
)
const GradeSimulator = dynamic(
  () => import("@/components/grade-simulator").then((m) => ({ default: m.GradeSimulator })),
  { loading: () => <ModulePageSkeleton className="min-h-[280px]" /> },
)
const EngagementCreditsTracker = dynamic(
  () =>
    import("@/components/engagement-credits-tracker").then((m) => ({
      default: m.EngagementCreditsTracker,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[280px]" /> },
)

const TAB_ITEMS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "breakdown", label: "Breakdown", icon: Target },
  { id: "simulator", label: "Simulator", icon: Calculator },
  { id: "engagement", label: "Engagement", icon: Sparkles },
] as const

type GradesTabId = (typeof TAB_ITEMS)[number]["id"]

export default function DashboardV2GradesPage() {
  const [studentId, setStudentId] = useState<number | null>(null)
  const [studentSession, setStudentSession] = useState("")
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<GradesTabId>("overview")

  useEffect(() => {
    let id: number | null = null
    let section = ""
    try {
      const sessionStr = localStorage.getItem("studentSession")
      if (sessionStr) {
        const data = JSON.parse(sessionStr)
        id = data.databaseId ? parseInt(data.databaseId, 10) : null
        section = data.section || ""
      }
      if (!id) {
        const dbId = sessionStorage.getItem("studentDatabaseId")
        if (dbId) id = parseInt(dbId, 10)
        section = sessionStorage.getItem("studentSection") || section
      }
      setStudentId(id)
      setStudentSession(section)
    } catch {
      const dbId = sessionStorage.getItem("studentDatabaseId")
      if (dbId) setStudentId(parseInt(dbId, 10))
      setStudentSession(sessionStorage.getItem("studentSection") || "")
    } finally {
      setLoading(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className={cn("h-10 w-10 animate-spin rounded-full", studentModuleSpinnerClass("grades"))} />
      </div>
    )
  }

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      {studentId ? <GradesAwaitingReviewBanner /> : null}
      <EmbedModuleCard>
        <div className="w-full min-w-0 space-y-4 overflow-x-hidden p-3 sm:p-4 md:p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
              Grades
            </p>
            <p className="mt-0.5 text-sm text-[var(--cc-text)]">
              Course score and what-if tools
              <span className="text-[var(--cc-text-muted)]"> · overview, breakdown, simulator</span>
            </p>
          </div>

          <div
            className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--muted)]/50 p-1 sm:grid-cols-4"
            role="tablist"
            aria-label="Grades sections"
          >
            {TAB_ITEMS.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium touch-manipulation sm:text-sm",
                    isActive
                      ? "bg-[var(--cc-accent)] text-white"
                      : "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              )
            })}
          </div>

          {studentId && activeTab === "overview" ? (
            <GradesOverview studentId={studentId} session={studentSession} />
          ) : null}
          {studentId && activeTab === "breakdown" ? (
            <GradeBreakdown studentId={studentId} session={studentSession} />
          ) : null}
          {studentId && activeTab === "simulator" ? (
            <GradeSimulator studentId={studentId} session={studentSession} />
          ) : null}
          {studentId && activeTab === "engagement" ? (
            <EngagementCreditsTracker studentId={studentId} session={studentSession} />
          ) : null}
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
