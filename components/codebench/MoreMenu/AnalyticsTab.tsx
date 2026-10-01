"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  Sparkles,
  Activity,
  TrendingUp,
  ListTree,
  CalendarDays,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { codebenchChromeKpi } from "@/lib/codebench-chrome-theme"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { parseCodebenchCoraJson } from "@/lib/codebench-cora-client"
import { CodebenchAnalyticsSkeleton } from "@/components/codebench/CodebenchSkeletons"
import { CodebenchStudioCoach } from "@/components/codebench/CodebenchStudioCoach"
import { buildCodebenchCoraRead, type CodebenchCoraRead } from "@/lib/codebench-analytics-read"
import { CodebenchStudentInsight } from "@/components/codebench/CodebenchStudentInsight"
import { getStudioSnapshot } from "@/lib/codebench-studio-analytics"
import { useStudioSnapshot } from "@/hooks/use-studio-snapshot"
import {
  ActivityWeekChart,
  ScoreTrendChart,
  StatusMixChart,
  WorkshopMixChart,
} from "./CodebenchAnalyticsCharts"

interface AnalyticsTabProps {
  code?: string
  studentId: string | null
  embedInDashboard?: boolean
  refreshKey?: number
  onOpenEditor?: () => void
}

type AnalyticsPayload = {
  performance: {
    submissionCount: number
    avgScore: number
    approvedCount: number
    xpEarned: number
    streakDays: number
    scoreTrend: Array<{ date: string; score: number }>
    activityByDay: Array<{ day: string; count: number }>
    statusMix: Array<{ name: string; value: number }>
    sourceCounts: { codebench: number; practice: number; challenge: number }
    recent: Array<{
      id: number
      source: string
      score: number | null
      status: string | null
      points: number | null
      submittedAt: string
      title: string
    }>
  }
}

function normalizePerformance(raw: AnalyticsPayload["performance"] | undefined): AnalyticsPayload["performance"] {
  return {
    submissionCount: raw?.submissionCount ?? 0,
    avgScore: raw?.avgScore ?? 0,
    approvedCount: raw?.approvedCount ?? 0,
    xpEarned: raw?.xpEarned ?? 0,
    streakDays: raw?.streakDays ?? 0,
    scoreTrend: raw?.scoreTrend ?? [],
    activityByDay: raw?.activityByDay ?? [],
    statusMix: raw?.statusMix ?? [],
    sourceCounts: raw?.sourceCounts ?? { codebench: 0, practice: 0, challenge: 0 },
    recent: raw?.recent ?? [],
  }
}

export function AnalyticsTab({
  studentId,
  embedInDashboard,
  refreshKey = 0,
  onOpenEditor,
}: AnalyticsTabProps) {
  const { roles } = useCodebenchChrome()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const studio = useStudioSnapshot(studentId)

  useEffect(() => {
    const load = async () => {
      if (!studentId) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/codebench/analytics?studentId=${encodeURIComponent(studentId)}`)
        const payload = await parseCodebenchCoraJson<{ performance?: AnalyticsPayload["performance"] }>(
          res,
          "Failed to load analytics",
        )
        setData({ performance: normalizePerformance(payload.performance) })
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Failed to load analytics")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [studentId, refreshKey])

  const studioSnapshot = studio ?? getStudioSnapshot(studentId ?? "local")
  const cora = useMemo<CodebenchCoraRead | null>(() => {
    if (!data?.performance) return null
    return buildCodebenchCoraRead(data.performance, studioSnapshot)
  }, [data, studioSnapshot])

  const Section = ({
    title,
    icon: Icon,
    thumbIndex = 0,
    children,
  }: {
    title: string
    icon: typeof BarChart3
    thumbIndex?: number
    children: ReactNode
  }) => (
    <section className={cn(EMBED_MATERIAL_PANEL, "p-4 sm:p-5")}>
      <div className="mb-4 flex items-center gap-2.5">
        <SolidListThumbTile thumb={codebenchChromeKpi(thumbIndex, roles)} icon={Icon} size="compact" />
        <h2 className={cn("text-lg font-semibold", PORTAL_TEXT)}>{title}</h2>
      </div>
      {children}
    </section>
  )

  const coach = studentId ? (
    <CodebenchStudioCoach studentId={studentId} variant="full" onOpenEditor={onOpenEditor} />
  ) : null

  if (loading) {
    return <CodebenchAnalyticsSkeleton />
  }

  if (error || !data || !cora) {
    return (
      <div className="space-y-5">
        {coach}
        <div className={cn("flex flex-col items-center gap-4 py-12 text-center", EMBED_MATERIAL_PANEL)}>
          <SolidListThumbTile thumb={roles.tool} icon={Sparkles} />
          <div>
            <p className={cn("font-semibold", PORTAL_TEXT)}>Analytics unavailable</p>
            <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>{error || "Try again in a moment."}</p>
          </div>
        </div>
      </div>
    )
  }

  const { performance } = data
  const workshopBars = cora.workshopBars ?? []
  const hasScoreTrend = (performance.scoreTrend ?? []).length > 0
  const hasActivity = (performance.activityByDay ?? []).some((d) => d.count > 0)
  const hasStatus = (performance.statusMix ?? []).some((d) => d.value > 0)
  const hasWorkshop = workshopBars.some((d) => d.value > 0)

  return (
    <div className="space-y-5">
      <CodebenchStudentInsight
        rows={studioSnapshot.runRows}
        errorCount={studioSnapshot.compileErrors}
        cleanCount={studioSnapshot.compileSuccesses}
      />
      {!hasWorkshop && performance.submissionCount === 0 && onOpenEditor ? (
        <Button
          className="h-11 w-full rounded-xl border-0 shadow-sm hover:opacity-90 sm:w-auto"
          style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
          onClick={onOpenEditor}
        >
          Open editor to start
        </Button>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Submissions", value: performance.submissionCount },
          { label: "Avg score", value: performance.submissionCount ? `${performance.avgScore}%` : "—" },
          { label: "Approved", value: performance.approvedCount },
          { label: "Streak", value: performance.streakDays ? `${performance.streakDays}d` : "—" },
        ].map((kpi, i) => (
          <div key={kpi.label} className={cn(EMBED_MATERIAL_PANEL, "p-3 text-center")}>
            <div className="mb-1 flex justify-center">
              <SolidListThumbTile thumb={codebenchChromeKpi(i, roles)} icon={Activity} size="compact" />
            </div>
            <div className={cn("text-xl font-bold tabular-nums", PORTAL_TEXT)}>{kpi.value}</div>
            <div className={cn("text-[10px] font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {(hasWorkshop || hasScoreTrend || hasActivity || hasStatus) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {hasWorkshop ? (
            <Section title="Workshop mix" icon={BarChart3} thumbIndex={3}>
              <WorkshopMixChart data={workshopBars} />
            </Section>
          ) : null}
          {hasScoreTrend ? (
            <Section title="Score trend" icon={TrendingUp} thumbIndex={0}>
              <ScoreTrendChart data={performance.scoreTrend} />
            </Section>
          ) : null}
          {hasActivity ? (
            <Section title="Weekly activity" icon={CalendarDays} thumbIndex={1}>
              <ActivityWeekChart data={performance.activityByDay} />
            </Section>
          ) : null}
          {hasStatus ? (
            <Section title="Submission status" icon={Activity} thumbIndex={4}>
              <StatusMixChart data={performance.statusMix} />
              <div className={cn("mt-3 grid grid-cols-3 gap-2 text-center text-xs", PORTAL_TEXT_MUTED)}>
                <div className="rounded-lg bg-[var(--muted)]/30 px-2 py-2">
                  <div className={cn("text-base font-bold tabular-nums", PORTAL_TEXT)}>
                    {performance.sourceCounts.codebench}
                  </div>
                  Editor
                </div>
                <div className="rounded-lg bg-[var(--muted)]/30 px-2 py-2">
                  <div className={cn("text-base font-bold tabular-nums", PORTAL_TEXT)}>
                    {performance.sourceCounts.practice}
                  </div>
                  Practice
                </div>
                <div className="rounded-lg bg-[var(--muted)]/30 px-2 py-2">
                  <div className={cn("text-base font-bold tabular-nums", PORTAL_TEXT)}>
                    {performance.sourceCounts.challenge}
                  </div>
                  Challenge
                </div>
              </div>
            </Section>
          ) : null}
        </div>
      )}

      {performance.recent.length > 0 ? (
        <Section title="Recent submissions" icon={ListTree} thumbIndex={0}>
          <ul className="space-y-2">
            {performance.recent.map((row) => (
              <li
                key={`${row.source}-${row.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className={cn("truncate text-sm font-medium", PORTAL_TEXT)}>{row.title}</div>
                  <div className={cn("text-xs capitalize", PORTAL_TEXT_MUTED)}>
                    {row.source} · {row.status || "pending"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={cn("text-base font-bold tabular-nums", PORTAL_TEXT)}>
                    {row.score != null ? `${row.score}%` : "—"}
                  </div>
                  <div className={cn("text-[10px]", PORTAL_TEXT_MUTED)}>
                    {row.points != null ? `+${row.points} XP` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  )
}
