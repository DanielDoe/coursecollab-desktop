"use client"

import { useState, useEffect } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts"
import { CardWrapper } from "./CardWrapper"
import { useTheme } from "@/hooks/use-theme"
import { resolveStudentDatabaseId, resolveStudentDisplayId, resolveStudentSection } from "@/lib/auth"
import {
  fetchCachedAttendance,
  fetchCachedGrades,
  fetchCachedHomeworkHistory,
  fetchCachedQuizHistory,
} from "@/lib/dashboard-v2/student-stats-client"

interface ComparisonData {
  name: string
  you: number
  benchmark: number
}

export function PerformanceComparisonChart() {
  const { theme } = useTheme()
  const tickFill = theme === "dark" ? "rgb(148 163 184)" : "rgb(100 116 139)"
  const [data, setData] = useState<ComparisonData[]>([])
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
        const [gradePayload, quizPayload, homeworkPayload, attendancePayload] = await Promise.all([
          fetchCachedGrades(dbId, section),
          fetchCachedQuizHistory(dbId),
          homeworkStudentId && section
            ? fetchCachedHomeworkHistory(homeworkStudentId, section)
            : Promise.resolve(null),
          fetchCachedAttendance(dbId),
        ])

        let quizYou = 0
        let quizClass = 80
        let hwYou = 0
        let hwClass = 80
        let attYou = 0

        if (gradePayload && typeof gradePayload === "object") {
          const { classAverages } = gradePayload as {
            classAverages?: { avg_quiz?: number; avg_homework?: number }
          }
          if (classAverages?.avg_quiz != null) quizClass = Math.round(Number(classAverages.avg_quiz) * 10) / 10
          if (classAverages?.avg_homework != null) hwClass = Math.round(Number(classAverages.avg_homework) * 10) / 10
        }

        if (quizPayload && typeof quizPayload === "object") {
          const { quizHistory } = quizPayload as {
            quizHistory?: { attempts?: { percentage: number }[] }[]
          }
          const allScores: number[] = []
          for (const q of quizHistory || []) {
            const best = q.attempts?.reduce((max: number, a: { percentage: number }) => Math.max(max, a.percentage ?? 0), 0) ?? 0
            if (best > 0) allScores.push(best)
          }
          quizYou = allScores.length > 0
            ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
            : 0
        }

        if (homeworkPayload && typeof homeworkPayload === "object") {
          const { homeworkHistory } = homeworkPayload as {
            homeworkHistory?: { status: string; attempts?: { percentage: number }[] }[]
          }
          const completed = (homeworkHistory || []).filter((h: { status: string }) => h.status === "completed")
          const scores = completed
            .map((h: { attempts?: { percentage: number }[] }) => {
              const best = h.attempts?.reduce((max: number, a: { percentage: number }) => Math.max(max, a.percentage ?? 0), 0) ?? 0
              return best
            })
            .filter((s: number) => s > 0)
          hwYou = scores.length > 0
            ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10
            : 0
        }

        if (attendancePayload && typeof attendancePayload === "object") {
          const { attendance } = attendancePayload as { attendance?: { attendance_percentage?: number } }
          if (attendance) attYou = Math.round(Number(attendance.attendance_percentage ?? 0) * 10) / 10
        }

        setData([
          { name: "Quiz Avg", you: quizYou, benchmark: quizClass },
          { name: "Homework Avg", you: hwYou, benchmark: hwClass },
          { name: "Attendance", you: attYou, benchmark: 90 },
        ])
      } catch (e) {
        console.error("[PerformanceComparisonChart] Failed:", e)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <CardWrapper delay={0.15}>
        <div className="dashboard-v2-chart-card p-4 sm:p-6 h-[220px] sm:h-[320px] animate-pulse bg-slate-200/30 dark:bg-white/5 rounded-2xl" />
      </CardWrapper>
    )
  }

  if (data.length === 0) {
    return (
      <CardWrapper delay={0.15}>
        <div className="dashboard-v2-chart-card p-4 sm:p-6">
          <h3 className="dashboard-v2-chart-title text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-3 sm:mb-6">
            Performance vs Class Average
          </h3>
          <div className="dashboard-v2-chart-bar h-[168px] sm:h-[200px] lg:h-[260px] flex items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
            <p className="text-sm text-slate-500 dark:text-slate-400">No performance data yet. Complete quizzes and homework to see your comparison.</p>
          </div>
        </div>
      </CardWrapper>
    )
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; dataKey: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null
    const you = payload.find((p) => p.dataKey === "you")
    const bench = payload.find((p) => p.dataKey === "benchmark")
    const diff = you && bench ? (you.value - bench.value) : 0
    return (
      <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-3 shadow-xl">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">{label}</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-600 dark:text-slate-300">You</span>
            <span className="text-sm font-semibold" style={{ color: "var(--cc-accent)" }}>{you?.value ?? 0}%</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-600 dark:text-slate-300">Class Avg</span>
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{bench?.value ?? 0}%</span>
          </div>
          {diff !== 0 && (
            <p className={`text-xs font-medium pt-1 ${diff > 0 ? "text-emerald-500" : "text-amber-500"}`}>
              {diff > 0 ? "+" : ""}{diff}% vs class
            </p>
          )}
        </div>
      </div>
    )
  }

  const BENCH_COLORS = ["rgb(148 163 184 / 0.4)", "rgb(148 163 184 / 0.35)", "rgb(148 163 184 / 0.3)"]

  return (
    <CardWrapper delay={0.15}>
      <div className="dashboard-v2-chart-card p-4 sm:p-6">
        <h3 className="dashboard-v2-chart-title mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)] sm:mb-6">
          Performance vs Class Average
        </h3>
        <div className="dashboard-v2-chart-bar h-[220px] min-h-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }} barCategoryGap="18%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.15)" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fill: tickFill, fontSize: 11, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={58}
                tick={{ fill: tickFill, fontSize: 11, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgb(148 163 184 / 0.06)" }} />
              <Bar dataKey="you" name="You" radius={[0, 4, 4, 0]} maxBarSize={22} barSize={16}>
                {data.map((_, i) => (
                  <Cell key={`you-${i}`} fill="var(--cc-accent)" />
                ))}
              </Bar>
              <Bar dataKey="benchmark" name="Class Avg" radius={[0, 4, 4, 0]} maxBarSize={22} barSize={16}>
                {data.map((_, i) => (
                  <Cell key={`bench-${i}`} fill={BENCH_COLORS[i % 3]} stroke="rgb(148 163 184 / 0.25)" strokeWidth={1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 sm:mt-4 flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: "var(--cc-accent)" }} />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">You</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-4 rounded-sm bg-slate-300/60 dark:bg-slate-500/40" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Class Avg</span>
          </div>
        </div>
      </div>
    </CardWrapper>
  )
}
