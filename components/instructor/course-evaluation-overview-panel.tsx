"use client"

import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Star,
  ThumbsUp,
  TrendingUp,
  Users,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardKpiCard, DashboardPanel } from "@/components/dashboard-v2/DashboardKpiCard"
import {
  FacultyIntegratedToolbar,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { useToast } from "@/hooks/use-toast"
import { LIKERT_5, likertLabel } from "@/lib/course-evaluation-survey"
import type { CourseEvaluationAnalytics } from "@/lib/course-evaluation-analytics"
import {
  CE_PANEL,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
  ceChartFill,
} from "@/lib/course-evaluations/course-evaluation-surface-classes"
import { cn } from "@/lib/utils"

function DistributionBars({
  distribution,
  labels,
}: {
  distribution: Record<string, number>
  labels?: Record<string, string>
}) {
  const entries = Object.entries(distribution).sort((a, b) => Number(a[0]) - Number(b[0]))
  const max = Math.max(1, ...entries.map(([, c]) => c))

  if (entries.length === 0) {
    return <p className={cn("py-4 text-center text-sm", PORTAL_TEXT_MUTED)}>No data yet</p>
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, count], index) => (
        <div key={key} className="flex items-center gap-2 text-sm">
          <span className={cn("w-28 shrink-0 truncate text-xs", PORTAL_TEXT_MUTED)}>
            {labels?.[key] ?? key}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(count / max) * 100}%`,
                backgroundColor: ceChartFill(index),
              }}
            />
          </div>
          <span className={cn("w-8 text-right text-xs tabular-nums", PORTAL_TEXT)}>{count}</span>
        </div>
      ))}
    </div>
  )
}

function CountList({
  items,
  emptyLabel,
}: {
  items: Array<{ label?: string; feature?: string; grade?: string; count: number }>
  emptyLabel: string
}) {
  if (items.length === 0) {
    return <p className={cn("py-2 text-sm", PORTAL_TEXT_MUTED)}>{emptyLabel}</p>
  }
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const label = item.label ?? item.feature ?? item.grade ?? "—"
        return (
          <div key={label} className="flex items-center gap-2 text-sm">
            <span className={cn("min-w-0 flex-1 truncate text-xs", PORTAL_TEXT)}>{label}</span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(item.count / max) * 100}%`,
                  backgroundColor: ceChartFill(index),
                }}
              />
            </div>
            <span className={cn("w-6 text-right text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
              {item.count}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const likertLabels = Object.fromEntries(
  LIKERT_5.map((opt) => [String(opt.value), likertLabel(LIKERT_5, opt.value)]),
)

export function CourseEvaluationOverviewPanel() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<CourseEvaluationAnalytics | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/course-evaluations?view=analytics&session=all")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setAnalytics(data.analytics ?? null)
    } catch {
      toast({ title: "Error", description: "Failed to load analytics", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-11 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 sm:gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[112px] rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[280px] rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className={cn(CE_PANEL, "py-10 text-center")}>
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No analytics available.</p>
      </div>
    )
  }

  const { totals, averages, nps } = analytics

  return (
    <div className="space-y-3">
      <FacultyIntegratedToolbar
        moduleId="course-evaluations"
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            Aggregated survey metrics · {totals.all} submission{totals.all === 1 ? "" : "s"} ·{" "}
            {totals.pending} pending
          </p>
        }
      />

      <motion.div
        className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
      >
        <DashboardKpiCard
          facultyModuleId="course-evaluations"
          label="Total submissions"
          value={totals.all}
          sub={`${totals.pending} pending review`}
          icon={Users}
        />
        <DashboardKpiCard
          facultyModuleId="course-evaluations"
          label="Pending approval"
          value={totals.pending}
          sub={totals.pending ? "Awaiting Canvas proof review" : "Queue is clear"}
          icon={Clock}
          semantic={totals.pending > 0 ? "warning" : undefined}
        />
        <DashboardKpiCard
          facultyModuleId="course-evaluations"
          label="Avg course experience"
          value={averages.overallExperience ?? "—"}
          sub={averages.overallExperience != null ? "Overall 1–5 Likert" : "No ratings yet"}
          icon={Star}
          semantic="info"
        />
        <DashboardKpiCard
          facultyModuleId="course-evaluations"
          label="NPS score"
          value={nps.score != null ? nps.score : "—"}
          sub={
            nps.responses > 0
              ? `${nps.promoters} promoters · ${nps.detractors} detractors`
              : "No NPS responses"
          }
          icon={TrendingUp}
          semantic="success"
        />
      </motion.div>

      <motion.div
        className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <DashboardKpiCard
          facultyModuleId="course-evaluations"
          label="Platform helpfulness"
          value={averages.platformHelpfulness ?? "—"}
          sub="CourseCollab improved learning"
          icon={ThumbsUp}
        />
        <DashboardKpiCard
          facultyModuleId="course-evaluations"
          label="Instructor clarity"
          value={averages.instructorClarity ?? "—"}
          sub="Bonus question avg"
          icon={BarChart3}
          semantic="info"
        />
        <DashboardKpiCard
          facultyModuleId="course-evaluations"
          label="Approval rate"
          value={analytics.approvalRate != null ? `${analytics.approvalRate}%` : "—"}
          sub={`${totals.approved} approved · ${totals.rejected} returned`}
          icon={CheckCircle2}
          semantic="success"
        />
        <DashboardKpiCard
          facultyModuleId="course-evaluations"
          label="Pass goal mismatches"
          value={analytics.passGoalMismatchCount}
          sub="Pass expectation ≠ current grade"
          icon={Star}
          semantic={analytics.passGoalMismatchCount > 0 ? "warning" : undefined}
        />
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardPanel title="Overall course experience">
          <DistributionBars distribution={analytics.ratingDistribution} labels={likertLabels} />
        </DashboardPanel>
        <DashboardPanel title="Platform helpfulness">
          <DistributionBars distribution={analytics.platformDistribution} labels={likertLabels} />
        </DashboardPanel>
        <DashboardPanel title="Top favorite features">
          <CountList items={analytics.favoriteFeatureCounts} emptyLabel="No feature selections yet" />
        </DashboardPanel>
        <DashboardPanel title="Top improvement areas">
          <CountList items={analytics.improveFeatureCounts} emptyLabel="No improvement picks yet" />
        </DashboardPanel>
        <DashboardPanel title="Workload (bonus)">
          <CountList items={analytics.workloadCounts} emptyLabel="No workload responses" />
        </DashboardPanel>
        <DashboardPanel title="AI tutor usage (bonus)">
          <CountList items={analytics.aiTutorUsageCounts} emptyLabel="No AI tutor responses" />
        </DashboardPanel>
        <DashboardPanel title="Pass expectation goals" className="lg:col-span-2">
          <CountList items={analytics.passGoalCounts} emptyLabel="No pass goals recorded" />
        </DashboardPanel>
      </div>
    </div>
  )
}
