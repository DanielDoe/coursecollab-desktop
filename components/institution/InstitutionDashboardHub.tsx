"use client"

import Link from "next/link"
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Clock3,
  GraduationCap,
  Sparkles,
  Users,
} from "lucide-react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { LazyMount } from "@/components/student/dashboard-v2/LazyMount"
import { DashboardKpiCard, DashboardPanel } from "@/components/dashboard-v2/DashboardKpiCard"
import { useDashboardKpiGrid } from "@/hooks/use-dashboard-kpi-grid"
import { sliceKpisForGrid } from "@/lib/dashboard-v2/kpi-layout"
import { dashboardV2PageStackClass } from "@/lib/dashboard-v2-layout"
import {
  CoraActivityChart,
  EngagementLineChart,
  ProductivityBarChart,
  SeatRadial,
  StackedActivityChart,
  UtilizationMeter,
} from "@/components/institution/institution-charts"
import { InstitutionDashboardHero } from "@/components/institution/InstitutionDashboardHero"
import { formatComparison, formatMetricValue } from "@/components/institution/InstitutionMetricTooltip"
import { INSTITUTION_DASHBOARD_BASE } from "@/lib/institution-portal-nav-config"
import type { InstitutionDashboardMetrics } from "@/lib/institutions/metrics/types"

function panelLink(href: string, label: string) {
  return (
    <Link href={href} className="text-sm font-medium text-[var(--cc-accent-dark)] hover:underline">
      {label}
    </Link>
  )
}

export function InstitutionDashboardHub({ data }: { data: InstitutionDashboardMetrics }) {
  const kpiGrid = useDashboardKpiGrid()
  const licensed = Boolean(data.header.planName)

  const kpiItems = [
    {
      key: "students",
      node: (
        <DashboardKpiCard
          label="Active students"
          value={formatMetricValue(data.kpis.activeStudents.value)}
          sub={formatComparison(data.kpis.activeStudents.comparison) ?? "\u00A0"}
          icon={Users}
          accent="cyan"
        />
      ),
    },
    {
      key: "instructors",
      node: (
        <DashboardKpiCard
          label="Active instructors"
          value={formatMetricValue(data.kpis.activeInstructors.value)}
          sub={data.kpis.activeInstructors.coraUsersHint ?? "\u00A0"}
          icon={GraduationCap}
          accent="indigo"
        />
      ),
    },
    {
      key: "courses",
      node: (
        <DashboardKpiCard
          label="Active courses"
          value={formatMetricValue(data.kpis.courseActivity.value)}
          sub={
            data.kpis.courseActivity.activeSections
              ? `${data.kpis.courseActivity.activeSections} sections`
              : "\u00A0"
          }
          icon={BookOpen}
          accent="violet"
        />
      ),
    },
    {
      key: "cora",
      node: (
        <DashboardKpiCard
          label="Cora workflows"
          value={formatMetricValue(data.kpis.coraWorkflows.value)}
          sub={formatComparison(data.kpis.coraWorkflows.comparison) ?? "\u00A0"}
          icon={Sparkles}
          accent="sky"
        />
      ),
    },
    {
      key: "grading",
      node: (
        <DashboardKpiCard
          label="Auto-graded"
          value={formatMetricValue(data.kpis.automatedSubmissions.value)}
          sub={
            data.kpis.automatedSubmissions.automationRate != null
              ? `${data.kpis.automatedSubmissions.automationRate}% of eligible`
              : "\u00A0"
          }
          icon={BarChart3}
          accent="emerald"
        />
      ),
    },
    {
      key: "hours",
      node: (
        <DashboardKpiCard
          label="Hours saved"
          value={`${formatMetricValue(data.kpis.estimatedHoursSaved.value)} hrs`}
          sub={formatComparison(data.kpis.estimatedHoursSaved.comparison) ?? "Estimated"}
          icon={Clock3}
          accent="amber"
        />
      ),
    },
  ]

  const visibleKpis = sliceKpisForGrid(kpiItems, kpiGrid)

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      className={dashboardV2PageStackClass}
    >
      <InstitutionDashboardHero data={data} />

      {!licensed ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
          <p className="text-sm font-semibold text-[var(--cc-text)]">License pending</p>
          <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
            Coverage metrics unlock after contract activation.
          </p>
          <Link
            href={`${INSTITUTION_DASHBOARD_BASE}/license`}
            className="mt-3 inline-flex text-sm font-medium text-[var(--cc-accent-dark)] hover:underline"
          >
            View license →
          </Link>
        </div>
      ) : null}

      <div className={kpiGrid.gridClass}>
        {visibleKpis.map((item, i) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.025 }}
            className="flex h-full min-w-0 w-full"
          >
            {item.node}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 sm:gap-4 lg:grid-cols-2">
        <LazyMount minHeight={280}>
          <DashboardPanel
            title="License utilization"
            action={panelLink(`${INSTITUTION_DASHBOARD_BASE}/license`, "View license")}
          >
            <UtilizationMeter
              used={data.licenseUtilization.currentActiveLearners}
              limit={data.licenseUtilization.licensedCapacity}
              statusLabel={data.licenseUtilization.statusLabel}
            />
            {data.licenseUtilization.daysRemaining != null ? (
              <p className="mt-3 text-xs text-[var(--cc-text-muted)]">
                {data.licenseUtilization.daysRemaining} days remaining · {data.licenseUtilization.coveredInstructors}{" "}
                faculty · {data.licenseUtilization.coveredCourses} courses
              </p>
            ) : null}
          </DashboardPanel>
        </LazyMount>

        <LazyMount minHeight={280}>
          <DashboardPanel
            title="Cora credits"
            action={panelLink(`${INSTITUTION_DASHBOARD_BASE}/cora`, "View usage")}
          >
            <SeatRadial
              used={data.coraUsage.creditsConsumed}
              limit={data.coraUsage.creditsConsumed + data.coraUsage.creditsRemaining || null}
            />
            <p className="mt-2 text-center text-xs tabular-nums text-[var(--cc-text-muted)]">
              {data.coraUsage.creditsConsumed.toLocaleString()} /{" "}
              {(data.coraUsage.creditsConsumed + data.coraUsage.creditsRemaining).toLocaleString()} credits
              {data.coraUsage.allowanceUsedPercent != null ? ` · ${data.coraUsage.allowanceUsedPercent}% used` : ""}
            </p>
            <div className="mt-3">
              <CoraActivityChart data={data.coraUsage.weeklyTrend.slice(-6)} />
            </div>
          </DashboardPanel>
        </LazyMount>
      </div>

      <LazyMount minHeight={200}>
        <DashboardPanel title="Student learning snapshot">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Practice accuracy",
                value: data.studentLearning.avgPracticeAccuracy.insufficientData
                  ? "Insufficient data"
                  : data.studentLearning.avgPracticeAccuracy.value != null
                    ? `${data.studentLearning.avgPracticeAccuracy.value}%`
                    : "No activity",
              },
              {
                label: "Students improving",
                value: data.studentLearning.studentsImproving.insufficientData
                  ? "Insufficient data"
                  : data.studentLearning.studentsImproving.value != null
                    ? `${data.studentLearning.studentsImproving.value}%`
                    : "—",
              },
              {
                label: "Post-intervention",
                value: data.studentLearning.postInterventionChange.unavailableReason ?? "Not available",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[var(--border)] bg-[var(--background)]/50 p-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--cc-text-muted)]">
                  {item.label}
                </p>
                <p className="mt-1 text-lg font-semibold text-[var(--cc-text)]">{item.value}</p>
              </div>
            ))}
          </div>
        </DashboardPanel>
      </LazyMount>

      <div className="grid grid-cols-1 items-stretch gap-3 sm:gap-4 lg:grid-cols-2">
        <LazyMount minHeight={280}>
          <DashboardPanel title="Student engagement">
            <EngagementLineChart data={data.studentEngagementTrend.weeklyActiveStudents} />
          </DashboardPanel>
        </LazyMount>
        <LazyMount minHeight={280}>
          <DashboardPanel title="Academic activity">
            <StackedActivityChart data={data.academicActivity.weekly} />
          </DashboardPanel>
        </LazyMount>
      </div>

      <LazyMount minHeight={280}>
        <DashboardPanel
          title="Instructor productivity"
          action={panelLink(`${INSTITUTION_DASHBOARD_BASE}/analytics?section=cora`, "Cora analytics")}
        >
          <ProductivityBarChart data={data.instructorProductivity.byCategory} />
        </DashboardPanel>
      </LazyMount>

      <LazyMount minHeight={200}>
        <DashboardPanel title="Alerts & recommendations">
          {data.alerts.length === 0 ? (
            <p className="text-sm text-[var(--cc-text-muted)]">No operational alerts for this period</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
              {data.alerts.map((alert) => (
                <li key={alert.id} className="px-3 py-3 hover:bg-muted/40">
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--cc-warning)]" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--cc-text)]">{alert.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">{alert.context}</p>
                      <Link
                        href={alert.href}
                        className="mt-1 inline-flex text-xs font-medium text-[var(--cc-accent-dark)] hover:underline"
                      >
                        {alert.action} →
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
      </LazyMount>

      {data.studentsNeedingAttention.available && data.studentsNeedingAttention.rows.length > 0 ? (
        <LazyMount minHeight={200}>
          <DashboardPanel
            title="Students needing attention"
            action={panelLink(`${INSTITUTION_DASHBOARD_BASE}/students`, "View all")}
          >
            <ul className="divide-y divide-[var(--border)]">
              {data.studentsNeedingAttention.rows.map((row) => (
                <li key={`${row.studentId}-${row.courseId}`} className="py-2.5 text-sm hover:bg-muted/40">
                  <p className="font-medium text-[var(--cc-text)]">{row.studentName}</p>
                  <p className="text-xs text-[var(--cc-text-muted)]">
                    {row.courseName} · {row.reason.replace(/_/g, " ")} · {row.recommendedAction}
                  </p>
                </li>
              ))}
            </ul>
          </DashboardPanel>
        </LazyMount>
      ) : null}

      <div className="flex justify-end pt-1">
        {panelLink(`${INSTITUTION_DASHBOARD_BASE}/analytics`, "Open full analytics →")}
      </div>
    </motion.div>
  )
}
