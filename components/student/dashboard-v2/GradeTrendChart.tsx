"use client"

import { useState, useEffect } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts"
import { CardWrapper } from "./CardWrapper"
import { useTheme } from "@/hooks/use-theme"
import { resolveStudentDatabaseId, resolveStudentDisplayId, resolveStudentSection } from "@/lib/auth"
import {
  fetchCachedGrades,
  fetchCachedHomeworkHistory,
  fetchCachedQuizHistory,
} from "@/lib/dashboard-v2/student-stats-client"
import { resolveStudentGradeDisplay } from "@/lib/student-grade-display"

interface WeekData {
  week: string
  overallGrade: number | undefined
  quizAvg: number
  homeworkAvg: number
}

function lifetimeQuizAverage(quizHistory: { attempts?: { percentage?: number }[] }[]): number {
  const allScores: number[] = []
  for (const q of quizHistory || []) {
    const best =
      q.attempts?.reduce((max, a) => Math.max(max, a.percentage ?? 0), 0) ?? 0
    if (best > 0) allScores.push(best)
  }
  return allScores.length > 0
    ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
    : 0
}

function lifetimeHomeworkAverage(
  homeworkHistory: { status?: string; attempts?: { percentage?: number; completed_at?: string }[] }[],
): number {
  const completed = (homeworkHistory || []).filter((h) => h.status === "completed")
  const scores = completed
    .map((h) => {
      const best =
        h.attempts?.reduce((max, a) => Math.max(max, a.percentage ?? 0), 0) ?? 0
      return best
    })
    .filter((s) => s > 0)
  return scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : 0
}

/** No weekly attempts recorded — show the honest lifetime average as a flat line, not a fake ramp. */
function applyFlatTrend(weeks: WeekData[], key: "quizAvg" | "homeworkAvg", value: number) {
  if (value <= 0) return
  weeks.forEach((w) => {
    w[key] = value
  })
}

export function GradeTrendChart() {
  const { theme } = useTheme()
  const tickFill = theme === "dark" ? "rgb(148 163 184)" : "rgb(100 116 139)"
  const dotStroke = theme === "dark" ? "rgb(30 41 59)" : "white"
  const [data, setData] = useState<WeekData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const dbId = resolveStudentDatabaseId()
    const displayId = resolveStudentDisplayId()
    const section = resolveStudentSection()

    if (!dbId) {
      setLoading(false)
      return
    }

    const homeworkStudentId = displayId || dbId
    const fetchData = async () => {
      try {
        const [gradePayload, quizPayload, homeworkPayload] = await Promise.all([
          fetchCachedGrades(dbId, section),
          fetchCachedQuizHistory(dbId),
          homeworkStudentId && section
            ? fetchCachedHomeworkHistory(homeworkStudentId, section)
            : Promise.resolve(null),
        ])

        const weeks: WeekData[] = []
        const now = new Date()

        for (let i = 5; i >= 0; i--) {
          const d = new Date(now)
          d.setDate(d.getDate() - i * 7)
          const weekStart = new Date(d)
          weekStart.setDate(weekStart.getDate() - weekStart.getDay())
          const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })
          weeks.push({
            week: label,
            overallGrade: 0,
            quizAvg: 0,
            homeworkAvg: 0,
          })
        }

        if (gradePayload && typeof gradePayload === "object") {
          const display = resolveStudentGradeDisplay(gradePayload)
          const total = Math.round(display.totalScore * 10) / 10
          weeks.forEach((w, i) => {
            w.overallGrade = i === weeks.length - 1 ? total : undefined
          })
        }

        if (quizPayload && typeof quizPayload === "object") {
          const { quizHistory } = quizPayload as {
            quizHistory?: { attempts?: { completed_at?: string; percentage?: number }[] }[]
          }
          const allByWeek: Map<number, number[]> = new Map()
          for (const q of quizHistory || []) {
            for (const a of q.attempts || []) {
              if (a.completed_at && a.percentage != null) {
                const d = new Date(a.completed_at)
                const weekNum = Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000))
                if (!allByWeek.has(weekNum)) allByWeek.set(weekNum, [])
                allByWeek.get(weekNum)!.push(a.percentage)
              }
            }
          }
          const weekNums = weeks.map((_, i) => {
            const d = new Date(now)
            d.setDate(d.getDate() - (5 - i) * 7)
            return Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000))
          })
          weekNums.forEach((wn, i) => {
            const scores = allByWeek.get(wn)
            weeks[i].quizAvg = scores && scores.length > 0
              ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
              : weeks[i - 1]?.quizAvg ?? 0
          })
          if (weeks[0].quizAvg === 0 && weeks.some((w) => w.quizAvg > 0)) {
            const firstNonZero = weeks.findIndex((w) => w.quizAvg > 0)
            for (let i = 0; i < firstNonZero; i++) weeks[i].quizAvg = weeks[firstNonZero].quizAvg
          }
          if (!weeks.some((w) => w.quizAvg > 0)) {
            applyFlatTrend(weeks, "quizAvg", lifetimeQuizAverage(quizHistory || []))
          }
        }

        if (homeworkPayload && typeof homeworkPayload === "object") {
          const { homeworkHistory } = homeworkPayload as {
            homeworkHistory?: { attempts?: { completed_at?: string; percentage?: number }[] }[]
          }
          const allByWeek: Map<number, number[]> = new Map()
          for (const h of homeworkHistory || []) {
            for (const a of h.attempts || []) {
              if (a.completed_at && a.percentage != null) {
                const d = new Date(a.completed_at)
                const weekNum = Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000))
                if (!allByWeek.has(weekNum)) allByWeek.set(weekNum, [])
                allByWeek.get(weekNum)!.push(a.percentage)
              }
            }
          }
          const weekNums = weeks.map((_, i) => {
            const d = new Date(now)
            d.setDate(d.getDate() - (5 - i) * 7)
            return Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000))
          })
          weekNums.forEach((wn, i) => {
            const scores = allByWeek.get(wn)
            weeks[i].homeworkAvg = scores && scores.length > 0
              ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
              : weeks[i - 1]?.homeworkAvg ?? 0
          })
          if (!weeks.some((w) => w.homeworkAvg > 0)) {
            applyFlatTrend(weeks, "homeworkAvg", lifetimeHomeworkAverage(homeworkHistory || []))
          }
        }

        setData(weeks)
      } catch (e) {
        console.error("[GradeTrendChart] Failed:", e)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <CardWrapper delay={0.1}>
        <div className="dashboard-v2-chart-card p-4 sm:p-6 h-[240px] sm:h-[320px] animate-pulse bg-slate-200/30 dark:bg-white/5 rounded-2xl" />
      </CardWrapper>
    )
  }

  const hasData = data.some((w) => w.quizAvg > 0 || w.homeworkAvg > 0 || (w.overallGrade != null && w.overallGrade > 0))

  if (!hasData || data.length === 0) {
    return (
      <CardWrapper delay={0.1}>
        <div className="dashboard-v2-chart-card p-4 sm:p-6">
          <h3 className="dashboard-v2-chart-title mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)] sm:mb-6">
            Grade Trend Over Time
          </h3>
          <div className="dashboard-v2-chart-area h-[200px] sm:h-[240px] lg:h-[300px] flex items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
            <p className="text-sm text-slate-500 dark:text-slate-400">No grade data yet. Complete quizzes and homework to see your trend.</p>
          </div>
        </div>
      </CardWrapper>
    )
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-3 shadow-xl">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Week of {label}</p>
        <div className="space-y-1">
          {payload.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-600 dark:text-slate-300">{entry.name}</span>
              <span className="text-sm font-semibold" style={{ color: entry.color }}>{entry.value}%</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Chart palette follows the selected appearance theme (CSS vars) with semantic
  // success/warning accents — no hardcoded brand hex.
  const quizColor = "var(--cc-accent)"
  const hwColor = "var(--cc-warning, #d97706)"
  const overallColor = "var(--cc-success, #059669)"
  const currentOverall = data.reduce<number>(
    (acc, w) => (w.overallGrade != null && w.overallGrade > 0 ? w.overallGrade : acc),
    0,
  )

  return (
    <CardWrapper delay={0.1}>
      <div className="dashboard-v2-chart-card p-4 sm:p-6">
        <div className="mb-3 sm:mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="dashboard-v2-chart-title text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
            Grade Trend Over Time
          </h3>
          {currentOverall > 0 ? (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Current grade{" "}
              <span className="text-sm font-semibold" style={{ color: overallColor }}>
                {currentOverall}%
              </span>
            </span>
          ) : null}
        </div>
        <div className="dashboard-v2-chart-area h-[220px] min-h-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="quizArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={quizColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={quizColor} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="hwArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={hwColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={hwColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fill: tickFill, fontSize: 11, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: tickFill, fontSize: 11, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgb(148 163 184 / 0.3)", strokeWidth: 1 }} />
              <ReferenceLine y={80} stroke="rgb(234 179 8 / 0.5)" strokeDasharray="6 4" strokeWidth={1.5} />
              {currentOverall > 0 ? (
                <ReferenceLine
                  y={currentOverall}
                  stroke={overallColor}
                  strokeWidth={1.5}
                  strokeDasharray="2 4"
                />
              ) : null}
              <Area type="monotone" dataKey="quizAvg" name="Quiz Avg" stroke={quizColor} strokeWidth={2.5} fill="url(#quizArea)" dot={{ r: 4, fill: quizColor, strokeWidth: 2, stroke: dotStroke }} activeDot={{ r: 6, fill: quizColor, strokeWidth: 2, stroke: dotStroke }} />
              <Area type="monotone" dataKey="homeworkAvg" name="Homework Avg" stroke={hwColor} strokeWidth={2.5} fill="url(#hwArea)" dot={{ r: 4, fill: hwColor, strokeWidth: 2, stroke: dotStroke }} activeDot={{ r: 6, fill: hwColor, strokeWidth: 2, stroke: dotStroke }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 sm:mt-4 flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: quizColor }} />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Quiz Avg</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hwColor }} />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Homework Avg</span>
          </div>
          {currentOverall > 0 ? (
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-4 rounded-full" style={{ backgroundColor: overallColor }} />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Current grade</span>
            </div>
          ) : null}
          <div className="flex items-center gap-2 ml-auto">
            <div className="h-2.5 w-2.5 rounded-full border-2 border-amber-500/60 border-dashed" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">80% target</span>
          </div>
        </div>
      </div>
    </CardWrapper>
  )
}
