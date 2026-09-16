"use client"

import {
  Activity,
  BarChart3,
  BookOpen,
  Clock3,
  Coins,
  Gauge,
  GraduationCap,
  LineChart,
  Percent,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react"
import {
  CoraActivityChart,
  EngagementLineChart,
  InstitutionChartCard,
  CourseMetricChart,
  CoursePerformanceGroupedChart,
  MixPieChart,
  NamedBarChart,
  ProductivityBarChart,
  SeatRadial,
  StackedActivityChart,
  TrajectoryStackedChart,
  UtilizationMeter,
} from "@/components/institution/institution-charts"
import { namedCountsToExportRows } from "@/lib/institutions/chart-export"
import { formatComparison, formatMetricValue } from "@/components/institution/InstitutionMetricTooltip"
import { CapabilityAuditTable, InsufficientMetric } from "@/components/institution/InstitutionResearchUi"
import { InstitutionResearchHub } from "@/components/institution/InstitutionResearchHub"
import { InstitutionKpiGrid, type InstitutionKpiItem } from "@/components/institution/portal/InstitutionPortalUi"
import { InstitutionCoraInsightsBlock } from "@/components/institution/InstitutionCoraInsightsBlock"
import type { InstitutionAnalyticsSection } from "@/lib/institution-analytics-nav-config"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import type { AnalyticsTab, CourseHealthRow, InstitutionAnalyticsMetrics, MetricValue } from "@/lib/institutions/metrics/types"
import { INSTITUTION_CHART_FILLS } from "@/lib/institution-chart-theme"
import { cn } from "@/lib/utils"

type TabPayload = Partial<Record<AnalyticsTab, InstitutionAnalyticsMetrics>>

type LooseMetric = MetricValue & {
  automationRate?: number | null
  successRate?: number | null
  activeSections?: number
  coraUsersHint?: string
}

function metricValue(m: LooseMetric, suffix = ""): string | number {
  if (m.insufficientData) return "Insufficient data"
  if (m.value == null) return "—"
  if (typeof m.value === "number" && suffix) return `${m.value.toLocaleString()}${suffix}`
  return formatMetricValue(m.value, suffix)
}

function metricSub(m: LooseMetric, fallback = "\u00A0"): string {
  return (
    formatComparison(m.comparison) ??
    (m.coraUsersHint ? m.coraUsersHint : null) ??
    (m.activeSections != null && m.activeSections > 0 ? `${m.activeSections} sections` : null) ??
    (m.automationRate != null ? `${m.automationRate}% of eligible` : null) ??
    (m.successRate != null ? `${m.successRate}% success rate` : null) ??
    (m.estimated ? "Estimated from workflow mix" : null) ??
    (m.insufficientData ? (m.unavailableReason ?? "Not enough data yet") : null) ??
    fallback
  )
}

function pickMetric(k: Record<string, LooseMetric>, keys: string[]): LooseMetric | undefined {
  for (const key of keys) {
    if (k[key]) return k[key]
  }
  return undefined
}

function LatencyWindowsTable({
  windows,
}: {
  windows: Array<{ key: string; label: string; n: number; score: number | null; insufficient: boolean }>
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className={cn("border-b border-[var(--border)] text-xs", PORTAL_TEXT_MUTED)}>
            <th className="py-2 pr-3">Window</th>
            <th className="py-2 pr-3">N</th>
            <th className="py-2">Mean score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {windows.map((w) => (
            <tr key={w.key}>
              <td className="py-2 pr-3 font-medium">{w.label}</td>
              <td className="py-2 pr-3 tabular-nums">{w.n}</td>
              <td className="py-2 tabular-nums">{w.insufficient || w.score == null ? "Insufficient data" : `${w.score}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AnalyticsStatGrid({
  items,
}: {
  items: Array<{ label: string; value: string | number; sub?: string; pending?: boolean }>
}) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5">
          <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", PORTAL_TEXT_MUTED)}>{item.label}</p>
          <p className={cn("mt-2 text-2xl font-semibold tabular-nums tracking-tight", item.pending ? PORTAL_TEXT_MUTED : PORTAL_TEXT)}>
            {item.value}
          </p>
          {item.sub ? <p className={cn("mt-1 text-xs leading-snug", PORTAL_TEXT_MUTED)}>{item.sub}</p> : null}
        </div>
      ))}
    </div>
  )
}

function statFrom(k: Record<string, LooseMetric>, keys: string[], label: string, fallbackSub: string) {
  const m = pickMetric(k, keys)
  if (!m) {
    return { label, value: "—", sub: fallbackSub, pending: false }
  }
  if (m.insufficientData) {
    return { label, value: "Insufficient data", sub: m.unavailableReason ?? fallbackSub, pending: true }
  }
  return { label, value: metricValue(m), sub: metricSub(m, fallbackSub), pending: false }
}

function buildEngagementKpis(e: {
  dau: LooseMetric
  wau: LooseMetric
  mau: LooseMetric
  wauMauRatio: LooseMetric
}): InstitutionKpiItem[] {
  return [
    { label: e.dau.label, value: metricValue(e.dau), sub: "Students active today", icon: Activity, valueKind: "count" },
    { label: e.wau.label, value: metricValue(e.wau), sub: "Last 7 days", icon: TrendingUp, valueKind: "count" },
    { label: e.mau.label, value: metricValue(e.mau), sub: "Last 30 days", icon: Users, valueKind: "count" },
    {
      label: e.wauMauRatio.label,
      value: metricValue(e.wauMauRatio, "%"),
      sub: metricSub(e.wauMauRatio, "Stickiness ratio"),
      icon: Percent,
      valueKind: "percent",
    },
  ]
}

function buildAssessmentKpis(kpis: Record<string, LooseMetric>): InstitutionKpiItem[] {
  const k = kpis
  return [
    {
      label: k.submissions?.label ?? "Graded submissions",
      value: metricValue(k.submissions ?? { value: 0, label: "" }),
      sub: "Eligible volume",
      icon: BarChart3,
      valueKind: "count",
    },
    {
      label: k.autoGraded?.label ?? "Auto-graded",
      value: metricValue(k.autoGraded ?? { value: 0, label: "" }),
      sub: "Automated grading",
      icon: Sparkles,
      valueKind: "count",
    },
    {
      label: k.automationRate?.label ?? "Automation rate",
      value: metricValue(k.automationRate ?? { value: 0, label: "" }, "%"),
      sub: metricSub(k.automationRate ?? { value: 0, label: "" }, "Of eligible submissions"),
      icon: Percent,
      valueKind: "percent",
    },
    {
      label: "Coverage",
      value:
        k.submissions?.value && k.autoGraded?.value
          ? `${Math.round((Number(k.autoGraded.value) / Number(k.submissions.value)) * 100)}%`
          : "—",
      sub: "Auto-grade share",
      icon: Gauge,
      valueKind: "percent",
    },
  ]
}

function buildCoraKpis(kpis: Record<string, LooseMetric>): InstitutionKpiItem[] {
  const k = kpis
  return [
    {
      label: k.workflows?.label ?? "Workflows",
      value: metricValue(k.workflows ?? { value: 0, label: "" }),
      sub: metricSub(k.workflows ?? { value: 0, label: "" }, "Completed"),
      icon: Sparkles,
      valueKind: "count",
    },
    {
      label: k.uniqueUsers?.label ?? "Unique users",
      value: metricValue(k.uniqueUsers ?? { value: 0, label: "" }),
      sub: "Students & faculty",
      icon: Users,
      valueKind: "count",
    },
    {
      label: k.credits?.label ?? "Credits consumed",
      value: metricValue(k.credits ?? { value: 0, label: "" }),
      sub: "Institution allowance",
      icon: Coins,
      valueKind: "count",
    },
    {
      label: "Success rate",
      value:
        k.workflows?.successRate != null ? `${k.workflows.successRate}%` : metricSub(k.workflows ?? { value: 0, label: "" }, "—"),
      sub: "Workflow completion",
      icon: Target,
      valueKind: "percent",
    },
  ]
}

function buildLearningKpis(l: {
  avgPracticeAccuracy: LooseMetric
  studentsImproving: LooseMetric
  postInterventionChange: LooseMetric
}): InstitutionKpiItem[] {
  return [
    {
      label: "Practice accuracy",
      value: metricValue(l.avgPracticeAccuracy, "%"),
      sub: metricSub(l.avgPracticeAccuracy, "Across practice attempts"),
      icon: Target,
      valueKind: "percent",
    },
    {
      label: "Students improving",
      value: metricValue(l.studentsImproving),
      sub: metricSub(l.studentsImproving, "Positive trend"),
      icon: TrendingUp,
      valueKind: "count",
    },
    {
      label: "Post-intervention",
      value: metricValue(l.postInterventionChange, "%"),
      sub: metricSub(l.postInterventionChange, "Score change"),
      icon: UserCheck,
      valueKind: "percent",
    },
    {
      label: "Learning signal",
      value: l.avgPracticeAccuracy.insufficientData ? "Building" : "Live",
      sub: "Requires tagged practice data",
      icon: BookOpen,
    },
  ]
}


function buildCourseKpis(summary: {
  totalActiveStudents: number
  avgCompletionRate: number | null
  avgAssessmentScore: number | null
  avgCoraAdoption: number | null
  studentsNeedingAttention: number
  coursesWithAlerts: number
}): InstitutionKpiItem[] {
  return [
    {
      label: "Active students",
      value: summary.totalActiveStudents.toLocaleString(),
      sub: "Across covered courses",
      icon: Users,
      valueKind: "count",
    },
    {
      label: "Avg completion",
      value: summary.avgCompletionRate != null ? `${summary.avgCompletionRate}%` : "—",
      sub: "Assessment completion rate",
      icon: Target,
      valueKind: "percent",
    },
    {
      label: "Avg assessment score",
      value: summary.avgAssessmentScore != null ? `${summary.avgAssessmentScore}%` : "—",
      sub: "Graded attempts in period",
      icon: BarChart3,
      valueKind: "percent",
    },
    {
      label: "Needs attention",
      value: summary.studentsNeedingAttention.toLocaleString(),
      sub:
        summary.coursesWithAlerts > 0
          ? `${summary.coursesWithAlerts} course(s) flagged`
          : "No course alerts",
      icon: UserCheck,
      valueKind: "count",
    },
  ]
}

function CourseInsightHighlights({
  rows,
  summary,
}: {
  rows: CourseHealthRow[]
  summary: {
    topEngagementCourse: string | null
    lowestCompletionCourse: string | null
    avgCoraAdoption: number | null
  }
}) {
  const alerts = rows.flatMap((row) =>
    row.statusFactors
      .filter((factor) => factor !== "No alerts")
      .map((factor) => ({ course: row.courseCode || row.courseName, factor })),
  )
  const insights: string[] = []
  if (summary.topEngagementCourse) {
    insights.push(`Highest engagement: ${summary.topEngagementCourse}`)
  }
  if (summary.lowestCompletionCourse) {
    insights.push(`Lowest completion: ${summary.lowestCompletionCourse}`)
  }
  if (summary.avgCoraAdoption != null) {
    insights.push(`Institution Cora adoption average: ${summary.avgCoraAdoption}%`)
  }
  if (insights.length === 0 && alerts.length === 0) {
    return null
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {insights.length > 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_94%,var(--muted))] p-4">
          <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", PORTAL_TEXT_MUTED)}>Key insights</p>
          <ul className={cn("mt-2 space-y-1.5 text-sm", PORTAL_TEXT)}>
            {insights.map((line) => (
              <li key={line} className="flex gap-2">
                <TrendingUp className="mt-0.5 size-4 shrink-0 text-[var(--cc-text-muted)]" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {alerts.length > 0 ? (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--cc-warning)_35%,var(--border))] bg-[color-mix(in_srgb,var(--cc-warning)_8%,var(--card))] p-4">
          <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", PORTAL_TEXT_MUTED)}>Courses to review</p>
          <ul className={cn("mt-2 space-y-1.5 text-sm", PORTAL_TEXT)}>
            {alerts.slice(0, 6).map((item) => (
              <li key={`${item.course}-${item.factor}`}>
                <span className="font-medium">{item.course}</span>
                <span className={PORTAL_TEXT_MUTED}> — {item.factor}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function AnalyticsKpiGrid({ items }: { items: InstitutionKpiItem[] }) {
  return <InstitutionKpiGrid items={items} />
}

export function InstitutionAnalyticsSectionPanel({
  section,
  payload,
}: {
  section: InstitutionAnalyticsSection
  payload: TabPayload
}) {
  if (section === "overview" && payload.overview?.overview) {
    const o = payload.overview.overview
    return (
      <div className="space-y-4">
        <AnalyticsStatGrid
          items={[
            statFrom(o.kpis, ["studentsCovered"], "Students covered", "License roster"),
            statFrom(o.kpis, ["activeStudents"], "Active students", "In selected period"),
            statFrom(o.kpis, ["activeCourses"], "Courses covered", "License-covered"),
            statFrom(o.kpis, ["aiAssistedStudents"], "AI assisted students", "Students with Cora use"),
            statFrom(o.kpis, ["aiAssistedSessions", "coraWorkflows"], "AI assisted sessions", "Cora workflows"),
            statFrom(o.kpis, ["practiceAttempts"], "Practice attempts", "Practice Hub"),
            statFrom(o.kpis, ["assessmentsSubmitted"], "Assessments submitted", "Completed quizzes"),
            statFrom(o.kpis, ["automatedFeedback", "automatedSubmissions"], "Automated feedback", "AI-graded answers"),
            statFrom(o.kpis, ["studentsNeedingAttention"], "Needs attention", "Heuristic flags"),
          ]}
        />
        <InstitutionChartCard title="Learning outcomes we can compute">
          <AnalyticsStatGrid
            items={[
              statFrom(o.outcomeKpis ?? o.kpis, ["avgAssessmentScore"], "Average assessment score", "Graded attempts"),
              statFrom(o.outcomeKpis ?? o.kpis, ["medianAssessmentScore"], "Median assessment score", "Graded attempts"),
              statFrom(o.outcomeKpis ?? o.kpis, ["practiceMastery", "avgPracticeAccuracy"], "Practice mastery", "Completed practice"),
            ]}
          />
        </InstitutionChartCard>
        <InstitutionChartCard title="Research outcomes not available yet" hint="These stay hidden until instruments or a study exist. Correlation is never labeled as causation.">
          <div className="grid gap-3 lg:grid-cols-2">
            <InsufficientMetric
              title="Independent performance"
              reason="Assessments are not tagged as AI restricted or independent checks."
              unblock="Set quizzes.ai_policy to AI_RESTRICTED, AI_UNAVAILABLE, or INDEPENDENT_CHECK, then collect independent attempts."
            />
            <InsufficientMetric
              title="AI-assisted performance and transfer"
              reason="No Cora session plus a later independent-tagged assessment for the same learner."
              unblock="Tag later assessments as independent. The next 14-day score is descriptive, not an AI effect."
            />
            <InsufficientMetric
              title="Pre/post learning gain"
              reason={
                o.prePostGain?.available
                  ? `Study "${o.prePostGain.studyName}" · N=${o.prePostGain.pairedN}`
                  : o.prePostGain?.note ?? "No configured pre and post instruments."
              }
              unblock={
                o.prePostGain?.available
                  ? undefined
                  : "Create a pre/post study and link pre & post quizzes under Research → Instruments."
              }
            />
            {o.prePostGain?.available ? (
              <InstitutionChartCard
                title="Pre/post gain funnel"
                hint={o.prePostGain.note}
                exportRows={namedCountsToExportRows(o.prePostGain.funnel)}
              >
                <NamedBarChart data={o.prePostGain.funnel} empty="Insufficient paired scores" valueLabel="Score" />
              </InstitutionChartCard>
            ) : null}
            <InsufficientMetric
              title="Interventions"
              reason={
                (o.kpis?.interventionsDelivered as { insufficientData?: boolean; value?: number } | undefined)?.insufficientData
                  ? "No delivered interventions in this period."
                  : `${(o.kpis?.interventionsDelivered as { value?: number } | undefined)?.value ?? 0} delivered`
              }
              unblock="Intervention sync runs when the Interventions tab loads."
            />
          </div>
        </InstitutionChartCard>
        <InstitutionChartCard title="Active users over time">
          <EngagementLineChart data={o.activeUsersOverTime} />
        </InstitutionChartCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <InstitutionChartCard title="Activity composition">
            <StackedActivityChart data={o.activityComposition} />
          </InstitutionChartCard>
          <InstitutionChartCard title="Usage by organizational unit">
            <NamedBarChart data={o.usageByOrgUnit} empty="Assign courses to org units to compare usage" />
          </InstitutionChartCard>
        </div>
        <InstitutionChartCard title="Adoption funnel">
          <NamedBarChart data={o.adoptionFunnel} empty="Funnel populates as roster activates" valueLabel="Users" />
        </InstitutionChartCard>
      </div>
    )
  }

  if (section === "questions" && payload.questions?.questions) {
    const answers = payload.questions.questions.answers
    const counts = {
      answered: answers.filter((a) => a.status === "answered").length,
      partial: answers.filter((a) => a.status === "partial").length,
      insufficient: answers.filter((a) => a.status === "insufficient").length,
    }
    return (
      <div className="space-y-4">
        <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
          These questions study how students learn with AI — not whether CourseCollab is being used. Correlation is never labeled as causation. Research outcomes stay hidden until instruments or a study exist.
        </p>
        <AnalyticsStatGrid
          items={[
            { label: "Answered with current data", value: String(counts.answered) },
            { label: "Partial / inferred", value: String(counts.partial) },
            { label: "Insufficient", value: String(counts.insufficient) },
          ]}
        />
        {answers.map((a) => (
          <InstitutionChartCard
            key={a.id}
            title={a.question}
            hint={`${a.evidence.replace("_", " ")} · ${a.status}`}
          >
            {a.headline ? <p className={cn("text-lg font-semibold", a.status === "insufficient" ? PORTAL_TEXT_MUTED : PORTAL_TEXT)}>{a.headline}</p> : null}
            {a.status === "insufficient" && !a.headline ? (
              <InsufficientMetric title="Insufficient data" reason={a.detail} unblock={a.unblock} />
            ) : (
              <>
                <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{a.detail}</p>
                {a.unblock && a.status !== "answered" ? (
                  <p className={cn("mt-2 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{a.unblock}</p>
                ) : null}
                {a.series.length > 0 ? (
                  <div className="mt-4">
                    <NamedBarChart data={a.series} empty="—" valueLabel={a.id === "hard_after_ai" ? "Accuracy" : "Count"} />
                  </div>
                ) : null}
              </>
            )}
          </InstitutionChartCard>
        ))}
      </div>
    )
  }

  if (section === "engagement") {
    const e = payload.engagement?.engagement
    const r = payload.retention?.retention
    return (
      <div className="space-y-4">
        {e ? (
          <>
            <AnalyticsKpiGrid items={buildEngagementKpis(e)} />
            <InstitutionChartCard title="Weekly active students">
              <EngagementLineChart data={e.dailyTrend} />
            </InstitutionChartCard>
            <InstitutionChartCard title="Activity by day of week">
              <NamedBarChart data={e.byDayOfWeek} empty="No login activity in range" />
            </InstitutionChartCard>
          </>
        ) : null}
        <InstitutionChartCard title="Retention">
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            {r?.unavailableReason ?? "Cohort retention requires activation cohort tracking — not yet recorded for this deployment"}
          </p>
        </InstitutionChartCard>
      </div>
    )
  }

  if (section === "learning") {
    const l = payload.learning?.learning
    const practice = l?.practice
    const concepts = l?.concepts ?? []
    return (
      <div className="space-y-4">
        {l ? <AnalyticsKpiGrid items={buildLearningKpis(l)} /> : null}
        {practice ? (
          <InstitutionChartCard title="Practice Hub" hint="Derived from practice_attempts and practice_answers">
            <AnalyticsStatGrid
              items={[
                { label: "Sessions", value: practice.sessions.toLocaleString(), sub: `${practice.sampleStudents} students` },
                { label: "Completed", value: practice.completedSessions.toLocaleString(), sub: `${practice.abandonedSessions} abandoned` },
                { label: "Questions attempted", value: practice.questionsAttempted.toLocaleString() },
                {
                  label: "First-attempt accuracy",
                  value: practice.firstAttemptAccuracy != null ? `${practice.firstAttemptAccuracy}%` : "Insufficient data",
                  pending: practice.firstAttemptAccuracy == null,
                },
                {
                  label: "Eventual accuracy",
                  value: practice.eventualAccuracy != null ? `${practice.eventualAccuracy}%` : "Insufficient data",
                  pending: practice.eventualAccuracy == null,
                },
                {
                  label: "Retry rate",
                  value: practice.retryRate != null ? `${practice.retryRate}%` : "—",
                  sub: "Same item attempted twice+",
                },
              ]}
            />
            <div className="mt-4">
              <NamedBarChart data={practice.sequences} empty="No practice sessions in this period" valueLabel="Sessions" />
            </div>
          </InstitutionChartCard>
        ) : null}
        <InstitutionChartCard title="Concept analytics" hint="Descriptive accuracy by question_bank.topic. Untagged items are grouped.">
          {concepts.length === 0 ? (
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
              Insufficient data — tag question_bank.topic and collect practice answers to enable concept heatmaps.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className={cn("border-b border-[var(--border)] text-xs", PORTAL_TEXT_MUTED)}>
                    <th className="py-2 pr-3">Topic</th>
                    <th className="py-2 pr-3">Students</th>
                    <th className="py-2 pr-3">Attempts</th>
                    <th className="py-2 pr-3">Accuracy</th>
                    <th className="py-2 pr-3">First attempt</th>
                    <th className="py-2">Eventual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {concepts.map((row) => (
                    <tr key={row.topic}>
                      <td className="py-2 pr-3 font-medium">{row.topic}</td>
                      <td className="py-2 pr-3 tabular-nums">{row.studentsExposed}</td>
                      <td className="py-2 pr-3 tabular-nums">{row.attempts}</td>
                      <td className="py-2 pr-3 tabular-nums">{row.accuracy}%</td>
                      <td className="py-2 pr-3 tabular-nums">{row.firstAttemptAccuracy != null ? `${row.firstAttemptAccuracy}%` : "—"}</td>
                      <td className="py-2 tabular-nums">{row.eventualAccuracy != null ? `${row.eventualAccuracy}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </InstitutionChartCard>
        {l && l.conceptImprovement.length > 0 ? (
          <InstitutionChartCard title="Highest first-to-eventual change" hint="Derived within-item change. Not a learning gain study.">
            <NamedBarChart data={l.conceptImprovement} empty="—" valueLabel="pp change" />
          </InstitutionChartCard>
        ) : null}
        {l?.trajectories && l.trajectories.length > 0 ? (
          <InstitutionChartCard
            title="Learning trajectories"
            hint="Count of students who practiced that week, by accuracy band. Roster attempt rate sits under the chart. Derived cut-points, not validated mastery."
          >
            <TrajectoryStackedChart data={l.trajectories} />
          </InstitutionChartCard>
        ) : null}
        {l?.prePostGain?.available ? (
          <InstitutionChartCard title="Pre/post learning gain" hint={l.prePostGain.note} exportRows={namedCountsToExportRows(l.prePostGain.funnel)}>
            <NamedBarChart data={l.prePostGain.funnel} empty="Insufficient paired scores" valueLabel="Score" />
          </InstitutionChartCard>
        ) : (
          <InsufficientMetric
            title="Pre/post learning gain"
            reason="Insufficient data"
            unblock={l?.prePostGain?.note ?? "Configure pre/post quiz instruments on a research study."}
          />
        )}
      </div>
    )
  }

  if (section === "assessment") {
    const a = payload.assessments?.assessments
    const extra = a?.extra
    return (
      <div className="space-y-4">
        {a ? <AnalyticsKpiGrid items={buildAssessmentKpis(a.kpis)} /> : null}
        {extra ? (
          <AnalyticsStatGrid
            items={[
              { label: "Started", value: extra.started.toLocaleString() },
              { label: "Completed", value: extra.completed.toLocaleString() },
              {
                label: "Completion rate",
                value: extra.completionRate != null ? `${extra.completionRate}%` : "Insufficient data",
                pending: extra.completionRate == null,
              },
              {
                label: "Average score",
                value: extra.avgScore != null ? `${extra.avgScore}%` : "Insufficient data",
                pending: extra.avgScore == null,
              },
              {
                label: "Median score",
                value: extra.medianScore != null ? `${extra.medianScore}%` : "Insufficient data",
                pending: extra.medianScore == null,
              },
            ]}
          />
        ) : null}
        {a ? (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <InstitutionChartCard title="Score distribution" hint="Completed attempts only">
                <NamedBarChart data={a.performanceDistribution} empty="No completed assessments" valueLabel="Attempts" />
              </InstitutionChartCard>
              <InstitutionChartCard title="Submission status">
                <NamedBarChart data={a.submissionStatus} empty="No attempts started" valueLabel="Attempts" />
              </InstitutionChartCard>
            </div>
            <InstitutionChartCard title="Assessment volume trend">
              <CoraActivityChart data={a.volumeTrend.map((w) => ({ ...w, credits: 0, activeUsers: 0 }))} />
            </InstitutionChartCard>
            {extra && extra.byCourse.length > 0 ? (
              <InstitutionChartCard title="Average score by course">
                <NamedBarChart data={extra.byCourse} empty="—" valueLabel="Avg score" />
              </InstitutionChartCard>
            ) : null}
          </>
        ) : (
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No assessment metrics for this period.</p>
        )}
      </div>
    )
  }

  if (section === "ai_assistance") {
    const c = payload.cora?.cora
    const assist = c?.assistance
    const link = c?.linkage
    return (
      <div className="space-y-4">
        <InstitutionCoraInsightsBlock />
        {c ? <AnalyticsKpiGrid items={buildCoraKpis(c.kpis)} /> : null}
        {assist ? (
          <InstitutionChartCard title="Assistance proxy" hint={assist.proxyNote}>
            <NamedBarChart data={assist.assistanceProxy} empty="No Cora sessions in this period" valueLabel="Sessions" />
          </InstitutionChartCard>
        ) : null}
        {c ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <InstitutionChartCard title="Workflow types" hint="Raw product workflow names">
              <MixPieChart data={c.workflowTypes} empty="No Cora workflows in this period" />
            </InstitutionChartCard>
            <InstitutionChartCard title="User composition">
              <MixPieChart data={c.userComposition} empty="No Cora users in this period" />
            </InstitutionChartCard>
          </div>
        ) : null}
        {assist ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <InstitutionChartCard title="Cora use by hour (UTC)">
              <NamedBarChart data={assist.byHour} empty="No hourly activity" valueLabel="Sessions" />
            </InstitutionChartCard>
            <InstitutionChartCard title="Cora use by weekday (UTC)">
              <NamedBarChart data={assist.byWeekday} empty="No weekday activity" valueLabel="Sessions" />
            </InstitutionChartCard>
          </div>
        ) : null}
        {c ? (
          <InstitutionChartCard title="Cora usage over time" hint="Credits are operational, not an educational outcome">
            <CoraActivityChart data={c.usageOverTime} />
          </InstitutionChartCard>
        ) : null}
        {link ? (
          <InstitutionChartCard title="AI → subsequent activity" hint={link.associationNote}>
            <AnalyticsStatGrid
              items={[
                { label: "Cora sessions", value: link.coraSessions.toLocaleString() },
                {
                  label: "Practice within 24h",
                  value: link.practiceFollow24hRate != null ? `${link.practiceFollow24hRate}%` : "Insufficient data",
                  sub: `N = ${link.windowNs.practice24h}`,
                  pending: link.practiceFollow24hRate == null,
                },
                {
                  label: "Practice score after 24h",
                  value: link.meanPracticeScoreAfter24h != null ? `${link.meanPracticeScoreAfter24h}%` : "Insufficient data",
                  sub: `N = ${link.windowNs.practice24h}`,
                  pending: link.meanPracticeScoreAfter24h == null,
                },
                {
                  label: "Assessment score within 7d",
                  value: link.meanAssessmentScoreAfter7d != null ? `${link.meanAssessmentScoreAfter7d}%` : "Insufficient data",
                  sub: `N = ${link.windowNs.assessment7d}`,
                  pending: link.meanAssessmentScoreAfter7d == null,
                },
                {
                  label: "No-Cora assessment score",
                  value: link.noCoraMeanAssessmentScore != null ? `${link.noCoraMeanAssessmentScore}%` : "Insufficient data",
                  sub: `Descriptive contrast only · N = ${link.windowNs.noCoraAssessments}`,
                  pending: link.noCoraMeanAssessmentScore == null,
                },
              ]}
            />
            {link.intensityVsLaterScore.length > 0 ? (
              <div className="mt-4">
                <NamedBarChart
                  data={link.intensityVsLaterScore}
                  empty="Cell minimum not met for intensity bins"
                  valueLabel="Later assessment score"
                />
              </div>
            ) : (
              <p className={cn("mt-3 text-xs", PORTAL_TEXT_MUTED)}>
                Intensity bins stay hidden until each bin has at least 10 students.
              </p>
            )}
          </InstitutionChartCard>
        ) : null}
        {c?.classified?.available ? (
          <>
            <InstitutionChartCard
              title="Assistance taxonomy (inferred)"
              hint={c.classified.note}
              exportRows={namedCountsToExportRows(c.classified.byType)}
              enablePngExport
            >
              <NamedBarChart data={c.classified.byType} empty="No classified interactions" valueLabel="Interactions" />
            </InstitutionChartCard>
            <InstitutionChartCard
              title="Assistance depth"
              hint={`N = ${c.classified.interactions} · median confidence ${c.classified.medianConfidence ?? "—"}`}
              exportRows={namedCountsToExportRows(c.classified.byDepth)}
              enablePngExport
            >
              <NamedBarChart data={c.classified.byDepth} empty="No depth data" valueLabel="Interactions" />
            </InstitutionChartCard>
          </>
        ) : (
          <InsufficientMetric
            title="Validated assistance taxonomy and depth"
            reason="Turn-level classifications accumulate as students use Cora on institution-covered courses."
            unblock="At least 10 classified interactions are required before taxonomy charts appear."
          />
        )}
        {c?.escalation?.available ? (
          <InstitutionChartCard title="Assistance ladder" hint={c.escalation.note}>
            <NamedBarChart data={c.escalation.ladder} empty="No escalation data" valueLabel="Sessions" />
          </InstitutionChartCard>
        ) : null}
        {c?.temporal ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <InstitutionChartCard title="Week of term" hint={c.temporal.note}>
              <NamedBarChart data={c.temporal.byWeekOfTerm} empty="No temporal data" valueLabel="Sessions" />
            </InstitutionChartCard>
            <InstitutionChartCard title="Deadline proximity">
              <NamedBarChart data={c.temporal.deadlineProximity} empty="No linked due dates" valueLabel="Sessions" />
            </InstitutionChartCard>
          </div>
        ) : null}
        {c?.reliance ? (
          <InstitutionChartCard title="AI reliance indicators" hint={c.reliance.note}>
            <AnalyticsStatGrid
              items={[
                { label: "AI assisted task share", value: c.reliance.aiAssistedTaskShare != null ? `${c.reliance.aiAssistedTaskShare}%` : "Insufficient data", pending: c.reliance.aiAssistedTaskShare == null },
                { label: "Interactions / session", value: c.reliance.interactionsPerSession ?? "Insufficient data", pending: c.reliance.interactionsPerSession == null },
                { label: "Median assistance depth", value: c.reliance.medianAssistanceDepth ?? "Insufficient data", pending: c.reliance.medianAssistanceDepth == null },
                { label: "Attempt before AI", value: c.reliance.attemptBeforeAiRate != null ? `${c.reliance.attemptBeforeAiRate}%` : "Insufficient data", pending: c.reliance.attemptBeforeAiRate == null, sub: `N = ${c.reliance.sampleN}` },
                { label: "AI-first rate", value: c.reliance.aiFirstInteractionRate != null ? `${c.reliance.aiFirstInteractionRate}%` : "Insufficient data", pending: c.reliance.aiFirstInteractionRate == null },
                { label: "Follow-through after AI", value: c.reliance.independentFollowThroughRate != null ? `${c.reliance.independentFollowThroughRate}%` : "Insufficient data", pending: c.reliance.independentFollowThroughRate == null },
              ]}
            />
          </InstitutionChartCard>
        ) : null}
      </div>
    )
  }

  if (section === "faculty" && payload.faculty?.faculty) {
    const f = payload.faculty.faculty
    return (
      <div className="space-y-4">
        <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
          {f.disclaimer ||
            "Faculty activity metrics describe platform usage and are not faculty performance evaluations. CourseCollab does not rank faculty."}
        </p>
        <InstitutionChartCard title="Instructor Cora activity">
          <NamedBarChart data={f.instructorComparison} empty="No faculty Cora usage" valueLabel="Workflows" />
        </InstitutionChartCard>
        <InstitutionChartCard title="Workflow automation mix (est. hours)">
          <ProductivityBarChart data={f.workflowMix} />
        </InstitutionChartCard>
      </div>
    )
  }

  if (section === "courses" && payload.courses?.courses) {
    const c = payload.courses.courses
    return (
      <div className="space-y-4">
        <AnalyticsKpiGrid items={buildCourseKpis(c.summary)} />
        <CourseInsightHighlights rows={c.rows} summary={c.summary} />
        <InstitutionChartCard title="Course comparison" hint="Detailed metrics for each covered course">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className={cn("border-b border-[var(--border)] text-xs", PORTAL_TEXT_MUTED)}>
                  <th className="py-2 pr-3">Course</th>
                  <th className="py-2 pr-3">Active</th>
                  <th className="py-2 pr-3">Completion</th>
                  <th className="py-2 pr-3">Avg score</th>
                  <th className="py-2 pr-3">Cora</th>
                  <th className="py-2 pr-3">Attention</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {c.rows.map((row) => (
                  <tr key={row.courseId}>
                    <td className="py-2 pr-3">
                      <p className="font-medium">{row.courseCode || row.courseName}</p>
                      {row.courseName && row.courseCode ? (
                        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{row.courseName}</p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{row.activeStudents}</td>
                    <td className="py-2 pr-3">
                      <div className="flex min-w-[88px] items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${row.completionRate != null ? Math.min(100, row.completionRate) : 0}%`,
                              background: INSTITUTION_CHART_FILLS[1],
                            }}
                          />
                        </div>
                        <span className="w-10 shrink-0 tabular-nums text-xs">
                          {row.completionRate != null ? `${row.completionRate}%` : "—"}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.avgAssessmentScore != null ? `${row.avgAssessmentScore}%` : "—"}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.coraAdoptionRate != null ? `${row.coraAdoptionRate}%` : "—"}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{row.studentsNeedingAttention}</td>
                    <td className="py-2">
                      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{row.statusFactors.join(" · ")}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </InstitutionChartCard>
        <InstitutionChartCard title="Performance overview" hint="Engagement index vs completion and Cora adoption (0–100%)">
          <CoursePerformanceGroupedChart rows={c.rows} />
        </InstitutionChartCard>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <InstitutionChartCard title="Engagement">
            <CourseMetricChart data={c.engagementByCourse} empty="No active students in period" valueLabel="Active students" colorOffset={0} />
          </InstitutionChartCard>
          <InstitutionChartCard title="Completion">
            <CourseMetricChart
              data={c.completionByCourse}
              empty="No completion data"
              valueLabel="Completion"
              valueSuffix="%"
              domainMax={100}
              colorOffset={1}
            />
          </InstitutionChartCard>
          <InstitutionChartCard title="Assessment scores">
            <CourseMetricChart
              data={c.scoreByCourse}
              empty="No graded attempts"
              valueLabel="Avg score"
              valueSuffix="%"
              domainMax={100}
              colorOffset={2}
            />
          </InstitutionChartCard>
          <InstitutionChartCard title="Cora adoption">
            <CourseMetricChart
              data={c.coraAdoptionByCourse}
              empty="No Cora usage"
              valueLabel="Cora adoption"
              valueSuffix="%"
              domainMax={100}
              colorOffset={4}
            />
          </InstitutionChartCard>
        </div>
      </div>
    )
  }

  if (section === "adoption") {
    const ad = payload.adoption?.adoption
    const lic = payload.license?.license
    return (
      <div className="space-y-4">
        {ad ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <InstitutionChartCard title="Student features">
              <NamedBarChart data={ad.studentFeatures} empty="No adoption data" valueLabel="% eligible" />
            </InstitutionChartCard>
            <InstitutionChartCard title="Instructor features">
              <NamedBarChart data={ad.instructorFeatures} empty="No adoption data" valueLabel="% eligible" />
            </InstitutionChartCard>
          </div>
        ) : null}
        {lic ? (
          <>
            <InstitutionChartCard title="Current capacity">
              <UtilizationMeter
                used={lic.currentCapacity.currentActiveLearners}
                limit={lic.currentCapacity.licensedCapacity}
                statusLabel={lic.currentCapacity.statusLabel}
              />
            </InstitutionChartCard>
            <InstitutionChartCard title="Cora credit consumption">
              <SeatRadial
                used={lic.currentCapacity.currentActiveLearners}
                limit={lic.currentCapacity.licensedCapacity}
              />
              <CoraActivityChart data={lic.coraConsumptionTrend} />
            </InstitutionChartCard>
          </>
        ) : null}
      </div>
    )
  }


  if (section === "independent" && payload.independent?.independent) {
    const d = payload.independent.independent
    const t = d.transfer
    return (
      <div className="space-y-4">
        <AnalyticsStatGrid
          items={[
            { label: "Tagged assessments", value: d.taggedAssessments.toLocaleString(), sub: `${d.untaggedAssessments} untagged` },
            { label: "Independent attempts", value: d.independentAttempts.toLocaleString() },
            { label: "AI-allowed attempts", value: d.assistedAttempts.toLocaleString() },
            {
              label: "Independent score",
              value: d.independentScore != null ? `${d.independentScore}%` : "Insufficient data",
              pending: d.independentScore == null,
              sub: "AI restricted / unavailable / independent check",
            },
            {
              label: "AI-allowed score",
              value: d.assistedScore != null ? `${d.assistedScore}%` : "Insufficient data",
              pending: d.assistedScore == null,
            },
            {
              label: "Assisted − independent",
              value: d.differencePp != null ? `${d.differencePp > 0 ? "+" : ""}${d.differencePp} pp` : "Insufficient data",
              pending: d.differencePp == null,
              sub: "Descriptive gap, not an AI effect",
            },
          ]}
        />
        {!d.available ? <InsufficientMetric title="Independent performance" reason="Insufficient data" unblock={d.unblock} /> : null}
        {d.byPolicy.length > 0 ? (
          <InstitutionChartCard title="Score by AI policy" hint="Mean completed-attempt score. Policy tags are instructor-set.">
            <NamedBarChart data={d.byPolicy} empty="No tagged attempts" valueLabel="Score" />
          </InstitutionChartCard>
        ) : null}
        {d.quadrants.length > 0 ? (
          <InstitutionChartCard title="Assisted vs independent quadrants" hint={d.scatterNote}>
            <NamedBarChart data={d.quadrants} empty="Need N≥10 students with both score types" valueLabel="Students" />
          </InstitutionChartCard>
        ) : (
          <InsufficientMetric
            title="Assisted vs independent quadrants"
            reason="Need at least 10 students with both an AI-allowed score and an independent-check score."
            unblock={d.scatterNote}
          />
        )}
        <InstitutionChartCard title="Transfer after Cora" hint={t.associationNote}>
          {t.available ? (
            <AnalyticsStatGrid
              items={[
                {
                  label: "Next independent (≤14d)",
                  value: t.transferScore != null ? `${t.transferScore}%` : "—",
                  sub: `${t.transferN} attempts`,
                },
                {
                  label: "Delayed independent (>14d)",
                  value: t.delayedScore != null ? `${t.delayedScore}%` : "—",
                  sub: `${t.delayedN} attempts`,
                },
                {
                  label: "No prior Cora",
                  value: t.noPriorCoraIndependentScore != null ? `${t.noPriorCoraIndependentScore}%` : "Insufficient data",
                  pending: t.noPriorCoraIndependentScore == null,
                  sub: "Shown only when N≥10",
                },
              ]}
            />
          ) : (
            <InsufficientMetric title="Transfer analytics" reason="Insufficient data" unblock={t.unblock} />
          )}
        </InstitutionChartCard>
        {d.delayed ? (
          <InstitutionChartCard title="Delayed transfer windows" hint={d.delayed.transferNote}>
            {d.delayed.transferWindows.every((w) => w.n === 0) ? (
              <InsufficientMetric title="Delayed transfer" reason="Insufficient data" unblock={d.delayed.unblock} />
            ) : (
              <LatencyWindowsTable windows={d.delayed.transferWindows} />
            )}
          </InstitutionChartCard>
        ) : null}
        <InstitutionChartCard title="Capability">
          <CapabilityAuditTable domain="independent" />
        </InstitutionChartCard>
      </div>
    )
  }

  if (section === "cognitive" && payload.cognitive?.cognitive) {
    const d = payload.cognitive.cognitive
    const b = d.behavioral
    return (
      <div className="space-y-4">
        <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{b.note}</p>
        <AnalyticsStatGrid
          items={[
            { label: "Cora sessions in window", value: b.windowN.toLocaleString(), sub: `${b.studentsWithPracticeAndCora} students with Cora` },
            {
              label: "Attempt before AI (24h)",
              value: b.attemptBeforeAiRate != null ? `${b.attemptBeforeAiRate}%` : "Insufficient data",
              pending: b.attemptBeforeAiRate == null,
              sub: "Practice in the 24h before Cora",
            },
            {
              label: "AI first (no practice in 7d)",
              value: b.aiFirstRate != null ? `${b.aiFirstRate}%` : "Insufficient data",
              pending: b.aiFirstRate == null,
            },
            {
              label: "Practice after AI (24h)",
              value: b.followThrough24hRate != null ? `${b.followThrough24hRate}%` : "Insufficient data",
              pending: b.followThrough24hRate == null,
            },
            {
              label: "Median hours, first practice → first Cora",
              value: b.medianHoursPracticeToCora != null ? `${b.medianHoursPracticeToCora}` : "Insufficient data",
              pending: b.medianHoursPracticeToCora == null,
              sub: "Students with both events",
            },
          ]}
        />
        {b.patterns.some((p) => p.value > 0) ? (
          <InstitutionChartCard title="Behavioral engagement patterns" hint="Session counts, not cognitive states">
            <NamedBarChart data={b.patterns} empty="No Cora sessions in this period" valueLabel="Sessions" />
          </InstitutionChartCard>
        ) : (
          <InsufficientMetric
            title="Behavioral engagement patterns"
            reason="No Cora sessions in the selected window to compare against practice timestamps."
            unblock="These rates appear once students have both practice attempts and Cora usage."
          />
        )}
        {d.trajectories.length > 0 ? (
          <InstitutionChartCard
            title="Learning trajectories"
            hint="Count of students who practiced that week, by accuracy band. Roster attempt rate sits under the chart. Derived cut-points, not validated mastery."
          >
            <TrajectoryStackedChart data={d.trajectories} />
          </InstitutionChartCard>
        ) : null}
        {d.surveys?.available ? (
          <InstitutionChartCard
            title="Validated survey constructs"
            hint={d.surveys.note}
            exportRows={namedCountsToExportRows(d.surveys.byConstruct)}
          >
            <NamedBarChart data={d.surveys.byConstruct} empty="No construct meets N minimum" valueLabel="Mean score" />
          </InstitutionChartCard>
        ) : (
          <InsufficientMetric title="Validated cognitive constructs" reason="Insufficient data" unblock={d.surveyNote} />
        )}
        <InstitutionChartCard title="Capability">
          <CapabilityAuditTable domain="cognitive" />
        </InstitutionChartCard>
      </div>
    )
  }

  if (section === "interventions" && payload.interventions?.interventions) {
    const d = payload.interventions.interventions
    return (
      <div className="space-y-4">
        {d.available ? (
          <>
            <AnalyticsStatGrid
              items={[
                { label: "Triggered", value: d.triggered.toLocaleString() },
                {
                  label: "Delivery rate",
                  value: d.deliveryRate != null ? `${d.deliveryRate}%` : "—",
                  sub: `${d.delivered} delivered`,
                },
                {
                  label: "Engagement rate",
                  value: d.engagementRate != null ? `${d.engagementRate}%` : "—",
                  sub: `${d.engaged} engaged after delivery`,
                },
                {
                  label: "Completion rate",
                  value: d.completionRate != null ? `${d.completionRate}%` : "—",
                  sub: `${d.completed} completed`,
                },
              ]}
            />
            <InstitutionChartCard
              title="Intervention funnel"
              hint="Descriptive delivery counts. Outcome change is not inferred."
              exportRows={namedCountsToExportRows(d.funnel)}
              enablePngExport
            >
              <NamedBarChart data={d.funnel} empty="No intervention records" valueLabel="Records" />
            </InstitutionChartCard>
          </>
        ) : (
          <InsufficientMetric title="Intervention funnel" reason="Insufficient data" unblock={d.unblock} />
        )}
        <InstitutionChartCard title="Capability">
          <CapabilityAuditTable domain="interventions" />
        </InstitutionChartCard>
      </div>
    )
  }

  if (section === "student_success" && payload.student_success?.student_success) {
    const d = payload.student_success.student_success
    return (
      <div className="space-y-4">
        <AnalyticsKpiGrid
          items={[
            { label: "Currently flagged", value: d.flaggedCount, sub: "Heuristic, not a prediction", icon: UserCheck, valueKind: "count" },
            { label: "Newly flagged", value: d.newlyFlagged || "Insufficient data", sub: "Needs flag history", icon: TrendingUp },
            { label: "Resolved flags", value: d.resolvedFlags || "Insufficient data", sub: "Needs flag history", icon: Target },
          ]}
        />
        <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{d.modelNote}</p>
        {d.rows.length > 0 ? (
          <InstitutionChartCard title="Attention list" hint="Student-level rows only when your role permits">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className={cn("border-b border-[var(--border)] text-xs", PORTAL_TEXT_MUTED)}>
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2 pr-3">Course</th>
                    <th className="py-2 pr-3">Reason</th>
                    <th className="py-2">Suggested next step</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {d.rows.map((row) => (
                    <tr key={`${row.studentId}-${row.courseId}`}>
                      <td className="py-2 pr-3 font-medium">{row.studentName}</td>
                      <td className="py-2 pr-3">{row.courseName}</td>
                      <td className="py-2 pr-3">{row.reason}</td>
                      <td className={cn("py-2", PORTAL_TEXT_MUTED)}>{row.recommendedAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </InstitutionChartCard>
        ) : (
          <InstitutionChartCard title="Attention list">
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
              {d.available ? "No students currently meet the heuristic flag rules." : "Student-level rows are hidden for this role. Aggregate flag count is shown above."}
            </p>
          </InstitutionChartCard>
        )}
        {d.predictive ? (
          <InstitutionChartCard title="Validated predictive models" hint={d.predictive.heuristicNote}>
            {d.predictive.available ? (
              <ul className="divide-y divide-[var(--border)] text-sm">
                {d.predictive.models
                  .filter((m) => m.status === "validated")
                  .map((m) => (
                    <li key={m.id} className="py-2">
                      <span className="font-medium">{m.name}</span>
                      <span className={cn("ml-2 text-xs", PORTAL_TEXT_MUTED)}>
                        {m.outcome} · {m.validationDesign ?? "held-out"} · N={m.heldOutN ?? "—"}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <InsufficientMetric title="Validated predictive model" reason="Insufficient data" unblock={d.predictive.unblock} />
            )}
          </InstitutionChartCard>
        ) : null}
      </div>
    )
  }

  if (section === "equity" && payload.equity?.equity) {
    const d = payload.equity.equity
    return (
      <div className="space-y-4">
        <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{d.note}</p>
        {d.available ? (
          <>
            <AnalyticsStatGrid
              items={[
                { label: "Authorized attributes", value: d.attributesImported.toLocaleString() },
                { label: "Visible subgroups", value: d.outcomeBySubgroup.length.toLocaleString() },
                { label: "Cell minimum", value: String(d.cellMinimum) },
              ]}
            />
            <InstitutionChartCard title="Subgroup roster (N)" exportRows={namedCountsToExportRows(d.subgroups)}>
              <NamedBarChart data={d.subgroups} empty="No visible subgroups" valueLabel="Students" />
            </InstitutionChartCard>
            <InstitutionChartCard
              title="Mean assessment score by subgroup"
              exportRows={d.outcomeBySubgroup.map((row) => ({ name: row.subgroup, value: row.meanScore }))}
            >
              <NamedBarChart
                data={d.outcomeBySubgroup.map((row) => ({ key: row.subgroup, name: row.subgroup, value: row.meanScore ?? 0 }))}
                empty="No scores"
                valueLabel="Mean score"
              />
            </InstitutionChartCard>
          </>
        ) : (
          <InsufficientMetric
            title="Equity and subgroups"
            reason={d.unavailableReason ?? "Insufficient data"}
            unblock={`Import authorized equity attributes via Research → Equity (N ≥ ${d.cellMinimum} per cell).`}
          />
        )}
        <InstitutionChartCard title="Capability">
          <CapabilityAuditTable domain="equity" />
        </InstitutionChartCard>
      </div>
    )
  }

  if (section === "longitudinal" && payload.longitudinal?.longitudinal) {
    const d = payload.longitudinal.longitudinal
    const weekPoints = d.panel.weekly.map((w) => ({
      week: w.week,
      label: w.label,
      credits: 0,
      workflows: 0,
      activeUsers: w.studentsActive,
    }))
    return (
      <div className="space-y-4">
        <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{d.panel.note}</p>
        <AnalyticsStatGrid
          items={[
            { label: "Roster", value: d.panel.rosterN.toLocaleString(), sub: `${d.panel.weekCount} weeks` },
            { label: "Learners with 2+ weeks", value: d.panel.studentsWithRepeatWeeks.toLocaleString() },
            {
              label: "Median weeks observed",
              value: d.panel.medianWeeksObserved != null ? String(d.panel.medianWeeksObserved) : "Insufficient data",
              pending: d.panel.medianWeeksObserved == null,
            },
            {
              label: "Panel completeness",
              value: d.panel.completenessPct != null ? `${d.panel.completenessPct}%` : "—",
              sub: `${d.panel.observedCells} / ${d.panel.possibleCells} student-weeks`,
            },
          ]}
        />
        <InstitutionChartCard title="Active learners by week" hint="Students with practice or assessment that week">
          <EngagementLineChart data={weekPoints} empty="No repeated weekly observations in this period" />
        </InstitutionChartCard>
        <InstitutionChartCard title="Delayed transfer" hint={d.delayed.transferNote}>
          {d.delayed.transferWindows.every((w) => w.n === 0) ? (
            <InsufficientMetric title="Delayed transfer" reason="Insufficient data" unblock={d.delayed.unblock} />
          ) : (
            <LatencyWindowsTable windows={d.delayed.transferWindows} />
          )}
        </InstitutionChartCard>
        <InstitutionChartCard title="Subsequent assessment after Cora" hint={d.delayed.subsequentNote}>
          {d.delayed.subsequentWindows.every((w) => w.n === 0) ? (
            <InsufficientMetric
              title="Subsequent assessment"
              reason="No completed quiz after a Cora session in a 60-day window."
              unblock="This is follow-through latency, not transfer."
            />
          ) : (
            <LatencyWindowsTable windows={d.delayed.subsequentWindows} />
          )}
        </InstitutionChartCard>
        <InstitutionChartCard title="Mixed-effects export" hint="Long-format student-weeks. CourseCollab does not estimate lmer.">
          <a
            className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-medium"
            href="/api/institution/research/export?dataset=mixed_effects&preset=last_30_days"
          >
            Download mixed-effects panel
          </a>
        </InstitutionChartCard>
        <InstitutionChartCard title="Validated predictive models" hint={d.models.heuristicNote}>
          {d.models.available ? (
            <ul className="divide-y divide-[var(--border)] text-sm">
              {d.models.models
                .filter((m) => m.status === "validated")
                .map((m) => (
                  <li key={m.id} className="py-2">
                    <span className="font-medium">{m.name}</span>
                    <span className={cn("ml-2 text-xs", PORTAL_TEXT_MUTED)}>
                      {m.outcome} · held-out N={m.heldOutN ?? "—"}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <InsufficientMetric title="Validated predictive model" reason="Insufficient data" unblock={d.models.unblock} />
          )}
        </InstitutionChartCard>
        <InstitutionChartCard title="Capability">
          <CapabilityAuditTable domain="longitudinal" />
        </InstitutionChartCard>
      </div>
    )
  }

  if (section === "pathways" && payload.pathways?.pathways) {
    const d = payload.pathways.pathways
    return (
      <div className="space-y-4">
        <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{d.note}</p>
        <AnalyticsStatGrid
          items={[
            { label: "Students with a sequence", value: d.studentsWithSequence.toLocaleString() },
            { label: "Shown paths", value: String(d.paths.length), sub: `N ≥ 10` },
            { label: "Suppressed students", value: d.suppressedStudents.toLocaleString(), sub: "Paths below cell minimum" },
          ]}
        />
        {d.paths.length > 0 ? (
          <InstitutionChartCard title="First three activities" hint="practice, Cora, or assessment in time order">
            <NamedBarChart data={d.paths} empty="—" valueLabel="Students" />
          </InstitutionChartCard>
        ) : (
          <InsufficientMetric title="Learning pathways" reason="Insufficient data" unblock={d.unblock} />
        )}
        <InstitutionChartCard title="Capability">
          <CapabilityAuditTable domain="pathways" />
        </InstitutionChartCard>
      </div>
    )
  }

  if (section === "feedback" && payload.feedback?.feedback) {
    const f = payload.feedback.feedback
    return (
      <div className="space-y-4">
        <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{f.note}</p>
        {f.available ? (
          <>
            <AnalyticsStatGrid
              items={[
                { label: "Feedback events", value: f.feedbackEvents.toLocaleString() },
                { label: "Automated / AI graded", value: f.automatedFeedback.toLocaleString() },
                { label: "Instructor feedback (proxy)", value: f.instructorFeedback.toLocaleString() },
                {
                  label: "Median latency",
                  value: f.medianLatencySec != null ? `${f.medianLatencySec}s` : "Insufficient data",
                  pending: f.medianLatencySec == null,
                },
              ]}
            />
            <InstitutionChartCard
              title="Feedback funnel"
              hint="View counts use feedback_viewed events when students open graded results."
              exportRows={namedCountsToExportRows(f.funnel)}
              enablePngExport
            >
              <NamedBarChart data={f.funnel} empty="No feedback events" valueLabel="Events" />
            </InstitutionChartCard>
          </>
        ) : (
          <InsufficientMetric
            title="Feedback analytics"
            reason="Insufficient data"
            unblock="Collect graded quiz answers with feedback in the selected period."
          />
        )}
      </div>
    )
  }

  if (section === "research") {
    return <InstitutionResearchHub />
  }

  if (section === "data_quality" && payload.data_quality?.data_quality) {
    const d = payload.data_quality.data_quality
    return (
      <div className="space-y-4">
        {d.warnings.length > 0 ? (
          <div className="space-y-2">
            {d.warnings.map((w) => (
              <p key={w} className={cn("rounded-xl border border-[var(--border)] px-4 py-3 text-sm", PORTAL_TEXT)}>
                {w}
              </p>
            ))}
          </div>
        ) : null}
        <InstitutionChartCard title="Instrumentation coverage" hint={`Cell minimum N = ${d.cellMinimum}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className={cn("border-b border-[var(--border)] text-xs", PORTAL_TEXT_MUTED)}>
                  <th className="py-2 pr-3">Measure</th>
                  <th className="py-2 pr-3">Coverage</th>
                  <th className="py-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {d.coverages.map((row) => (
                  <tr key={row.label}>
                    <td className="py-2 pr-3 font-medium">{row.label}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.percent != null ? `${row.percent}%` : "—"}
                      <span className={cn("ml-2 text-xs", PORTAL_TEXT_MUTED)}>
                        {row.numerator}/{row.denominator}
                      </span>
                    </td>
                    <td className={cn("py-2 text-xs", PORTAL_TEXT_MUTED)}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </InstitutionChartCard>
      </div>
    )
  }

  return (
    <div className={cn(PORTAL_CARD, "p-5")}>
      <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No data for this section yet.</p>
    </div>
  )
}
