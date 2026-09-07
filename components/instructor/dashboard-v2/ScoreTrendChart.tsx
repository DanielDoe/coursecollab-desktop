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
import { cn } from "@/lib/utils"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"

interface WeekData {
  week: string
  avgScore: number
  attempts: number
}

export function ScoreTrendChart() {
  const { courseScopeVersion, portal } = useInstructorDashboardV2()
  const [data, setData] = useState<WeekData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const url =
      portal === "admin" ? "/api/admin/dashboard/charts" : "/api/instructor/dashboard/charts"
    const headers = portal === "admin" ? buildAdminApiHeaders() : buildInstructorApiHeaders()
    fetch(url, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.scoreTrend) setData(j.scoreTrend)
        else setData([])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [courseScopeVersion, portal])

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean
    payload?: { value: number; payload: WeekData }[]
  }) => {
    if (!active || !payload?.length) return null
    const p = payload[0].payload
    return (
      <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-3 shadow-xl">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{p.week}</p>
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{p.avgScore}% avg</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{p.attempts} attempts</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={cn("p-5 sm:p-6 rounded-2xl sm:rounded-3xl", "bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl",
        "border border-slate-200/60 dark:border-white/[0.08]",
        "shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.35)]")}>
        <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-6">Class Average Score</h3>
        <div className="h-[260px] animate-pulse bg-slate-200/30 dark:bg-white/5 rounded-xl" />
      </div>
    )
  }

  const hasData = data.some((d) => d.avgScore > 0 || d.attempts > 0)

  return (
    <div className={cn("p-5 sm:p-6 rounded-2xl sm:rounded-3xl", "bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl",
      "border border-slate-200/60 dark:border-white/[0.08]",
      "shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.35)]")}>
      <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-6">
        Class Average Score (Last 6 Weeks)
      </h3>
      {!hasData ? (
        <div className="h-[260px] flex items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
          <p className="text-sm text-slate-500 dark:text-slate-400">No score data yet</p>
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="scoreStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fill: "rgb(100 116 139)", fontSize: 11, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "rgb(100 116 139)", fontSize: 11, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgb(148 163 184 / 0.3)", strokeWidth: 1 }} />
              <ReferenceLine y={80} stroke="rgb(234 179 8 / 0.5)" strokeDasharray="6 4" strokeWidth={1.5} />
              <Area
                type="monotone"
                dataKey="avgScore"
                name="Avg Score"
                stroke="url(#scoreStroke)"
                strokeWidth={2.5}
                fill="url(#scoreArea)"
                dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "white" }}
                activeDot={{ r: 6, fill: "#10b981", strokeWidth: 2, stroke: "white" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
