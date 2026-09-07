"use client"

import { useMemo } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "@/lib/utils"
import {
  CP_PANEL,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/classroom-points/classroom-points-surface-classes"
import {
  CLASSROOM_POINTS_FOR_FULL_GRADE,
  classroomRawPointsToGradePoints10,
} from "@/lib/classroom-points-grade-scale"

type StudentRow = {
  student_id: number
  full_name: string
  total_points: number
  award_count: number
}

type AwardRow = {
  points: number
  category?: string
  awarded_at: string
  student_name: string
  submission_id?: number | null
  submission_title?: string | null
}

type PendingRow = {
  points: number
  submission_id?: number | null
  submission_title?: string | null
  student_name?: string
}

const TICK = { fontSize: 11, fill: "var(--cc-text-muted)" }
const TICK_SM = { fontSize: 10, fill: "var(--cc-text-muted)" }
const GRID = "stroke-[var(--border)]/60"

function chartFill(index: number): string {
  const palette = [
    "var(--cc-accent)",
    "var(--cc-sem-info)",
    "var(--cc-sem-success)",
    "var(--cc-sem-warning)",
    "var(--cc-sem-danger)",
    "var(--cc-accent-dark)",
  ]
  return palette[index % palette.length]
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function lastNDates(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function truncateLabel(label: string, max = 28): string {
  const t = label.trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function CpChartPanel({
  title,
  children,
  action,
  className,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn(CP_PANEL, "h-full", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className={cn("flex h-[220px] items-center justify-center px-4 text-center text-sm", PORTAL_TEXT_MUTED)}>
      {label}
    </div>
  )
}

export function ClassroomPointsOverviewCharts({
  students,
  recentAwards,
  pendingApprovals = [],
  activeAssignmentCount = 0,
  loading,
  pointsForFullGrade = CLASSROOM_POINTS_FOR_FULL_GRADE,
}: {
  students: StudentRow[]
  recentAwards: AwardRow[]
  pendingApprovals?: PendingRow[]
  activeAssignmentCount?: number
  loading: boolean
  pointsForFullGrade?: number
}) {
  const stats = useMemo(() => {
    const rawList = students.map((s) => Number(s.total_points) || 0)
    const engaged = students.filter((s) => Number(s.award_count) > 0).length
    const engagementPct = students.length ? Math.round((engaged / students.length) * 100) : 0
    const medRaw = median(rawList)
    const medGrade = median(
      rawList.map((r) => classroomRawPointsToGradePoints10(r, pointsForFullGrade)),
    )

    const gradeBuckets = [
      { slice: "0–2", students: 0 },
      { slice: "2–4", students: 0 },
      { slice: "4–6", students: 0 },
      { slice: "6–8", students: 0 },
      { slice: "8–10", students: 0 },
    ]
    for (const r of rawList) {
      const g = classroomRawPointsToGradePoints10(r, pointsForFullGrade)
      if (g <= 2) gradeBuckets[0].students += 1
      else if (g <= 4) gradeBuckets[1].students += 1
      else if (g <= 6) gradeBuckets[2].students += 1
      else if (g <= 8) gradeBuckets[3].students += 1
      else gradeBuckets[4].students += 1
    }

    const dates = lastNDates(14)
    const dayMap = new Map<string, { pts: number; count: number }>()
    for (const d of dates) dayMap.set(d, { pts: 0, count: 0 })
    for (const a of recentAwards) {
      if (!a.awarded_at) continue
      const key = new Date(a.awarded_at).toISOString().slice(0, 10)
      if (dayMap.has(key)) {
        const cur = dayMap.get(key)!
        cur.pts += Number(a.points) || 0
        cur.count += 1
        dayMap.set(key, cur)
      }
    }
    const timeline = dates.map((d) => ({
      day: d.slice(5),
      pts: dayMap.get(d)?.pts ?? 0,
      awards: dayMap.get(d)?.count ?? 0,
    }))

    const catMap = new Map<string, number>()
    for (const a of recentAwards) {
      const c = (a.category || "other").replace(/_/g, " ")
      catMap.set(c, (catMap.get(c) ?? 0) + Number(a.points) || 0)
    }
    const categoryData = [...catMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)

    const pendingByAssignment = new Map<string, number>()
    for (const p of pendingApprovals) {
      const label = truncateLabel(p.submission_title || "Unknown assignment", 32)
      pendingByAssignment.set(label, (pendingByAssignment.get(label) ?? 0) + 1)
    }
    const pendingQueue = [...pendingByAssignment.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    const top = [...students]
      .sort((a, b) => Number(b.total_points) - Number(a.total_points))
      .slice(0, 8)
      .map((s) => ({
        name: truncateLabel(s.full_name, 20),
        pts: Number(s.total_points) || 0,
        grade: classroomRawPointsToGradePoints10(Number(s.total_points) || 0, pointsForFullGrade),
        awards: Number(s.award_count) || 0,
      }))

    const participationBands = [
      { band: "0 awards", students: students.filter((s) => !s.award_count).length },
      { band: "1–2", students: students.filter((s) => s.award_count >= 1 && s.award_count <= 2).length },
      { band: "3–5", students: students.filter((s) => s.award_count >= 3 && s.award_count <= 5).length },
      { band: "6+", students: students.filter((s) => s.award_count >= 6).length },
    ]

    return {
      engaged,
      engagementPct,
      medRaw,
      medGrade,
      gradeBuckets,
      timeline,
      categoryData,
      pendingQueue,
      top,
      participationBands,
    }
  }, [students, recentAwards, pendingApprovals, pointsForFullGrade])

  const tooltipStyle = {
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--cc-text)",
    fontSize: 12,
  }

  if (loading) {
    return (
      <div className="grid gap-4 border-t border-[var(--border)]/60 pt-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={cn(CP_PANEL, "h-[280px] animate-pulse bg-muted/40")} />
        ))}
      </div>
    )
  }

  const hasStudents = students.length > 0
  const hasAwards = recentAwards.length > 0
  const hasPending = pendingApprovals.length > 0

  return (
    <div className="space-y-4 border-t border-[var(--border)]/60 pt-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CpChartPanel title="Approval queue">
          {hasPending ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.pendingQueue} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className={GRID} />
                  <XAxis type="number" allowDecimals={false} tick={TICK} />
                  <YAxis type="category" dataKey="name" width={108} tick={TICK_SM} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [`${v} submission${v === 1 ? "" : "s"}`, "Pending"]}
                  />
                  <Bar dataKey="count" fill="var(--cc-sem-warning)" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label="No submissions waiting for review." />
          )}
        </CpChartPanel>

        <CpChartPanel
          title="Participation depth"
          action={
            hasStudents ? (
              <span className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                {stats.engagementPct}% earned at least one award
              </span>
            ) : null
          }
        >
          {hasStudents ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.participationBands} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className={GRID} />
                  <XAxis dataKey="band" tick={TICK} />
                  <YAxis allowDecimals={false} tick={TICK} width={36} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} students`, "Count"]} />
                  <Bar dataKey="students" radius={[6, 6, 0, 0]}>
                    {stats.participationBands.map((_, i) => (
                      <Cell key={i} fill={chartFill(i)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label="No students in this session scope." />
          )}
        </CpChartPanel>

        <CpChartPanel title="Awards over time (14 days)">
          {hasAwards ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.timeline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cpPtsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--cc-accent)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--cc-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className={GRID} />
                  <XAxis dataKey="day" tick={TICK_SM} />
                  <YAxis yAxisId="pts" tick={TICK} width={44} />
                  <YAxis yAxisId="count" orientation="right" tick={TICK} width={32} allowDecimals={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number, name: string) =>
                      name === "pts" ? [`${v.toFixed(1)} pts`, "Points awarded"] : [`${v}`, "Awards"]
                    }
                  />
                  <Area yAxisId="pts" type="monotone" dataKey="pts" stroke="var(--cc-accent)" fill="url(#cpPtsGrad)" strokeWidth={2} />
                  <Area yAxisId="count" type="monotone" dataKey="awards" stroke="var(--cc-sem-info)" fill="none" strokeWidth={1.5} strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label="No approved awards in the recent window." />
          )}
        </CpChartPanel>

        <CpChartPanel title="Points by category">
          {hasAwards && stats.categoryData.length > 0 ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.categoryData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className={GRID} />
                  <XAxis type="number" tick={TICK} />
                  <YAxis type="category" dataKey="name" width={96} tick={TICK_SM} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)} pts`, "Total"]} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={14}>
                    {stats.categoryData.map((_, i) => (
                      <Cell key={i} fill={chartFill(i)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label="No category breakdown yet." />
          )}
        </CpChartPanel>

        <CpChartPanel
          title="10-pt grade slice"
          action={
            <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              Median {hasStudents ? `${stats.medGrade.toFixed(2)}/10` : "—"}
            </span>
          }
        >
          {hasStudents ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.gradeBuckets} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className={GRID} />
                  <XAxis dataKey="slice" tick={TICK} />
                  <YAxis allowDecimals={false} tick={TICK} width={36} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} students`, "Count"]} />
                  <Bar dataKey="students" radius={[6, 6, 0, 0]}>
                    {stats.gradeBuckets.map((_, i) => (
                      <Cell key={i} fill={chartFill(i)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label="No students in this session scope." />
          )}
        </CpChartPanel>

        <CpChartPanel
          title="Top earners"
          action={
            activeAssignmentCount > 0 ? (
              <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>{activeAssignmentCount} open assignments</span>
            ) : null
          }
        >
          {hasStudents ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.top} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className={GRID} />
                  <XAxis type="number" tick={TICK} />
                  <YAxis type="category" dataKey="name" width={96} tick={TICK_SM} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)} pts`, "Total"]} />
                  <Bar dataKey="pts" radius={[0, 6, 6, 0]} barSize={14}>
                    {stats.top.map((_, i) => (
                      <Cell key={i} fill={chartFill(i)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart label="No student points yet." />
          )}
        </CpChartPanel>
      </div>
    </div>
  )
}
