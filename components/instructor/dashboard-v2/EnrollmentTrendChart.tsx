"use client"

import { useState, useEffect } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import { cn } from "@/lib/utils"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"

interface DayData {
  date: string
  label: string
  count: number
}

export function EnrollmentTrendChart() {
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [data, setData] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch("/api/admin/dashboard/charts", { headers: buildAdminApiHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.enrollmentTrend) setData(j.enrollmentTrend)
        else setData([])
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [courseScopeVersion])

  const shell = cn(
    "p-5 sm:p-6 rounded-2xl sm:rounded-3xl h-full",
    "bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl",
    "border border-slate-200/60 dark:border-white/[0.08]",
    "shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.35)]",
  )

  if (loading) {
    return (
      <div className={shell}>
        <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Platform Events (7 Days)
        </h3>
        <div className="h-[260px] animate-pulse bg-slate-200/30 dark:bg-white/5 rounded-xl" />
      </div>
    )
  }

  const hasData = data.some((d) => d.count > 0)
  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className={shell}>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
            Platform Events (7 Days)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Audit log volume across admin, faculty, and student portals
          </p>
        </div>
        {hasData ? (
          <span className="text-sm font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
            {total} total
          </span>
        ) : null}
      </div>
      {!hasData ? (
        <div className="h-[260px] flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 gap-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">No platform events in the last 7 days</p>
          <p className="text-xs text-slate-400">Events appear as users log in and navigate the system</p>
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "rgb(100 116 139)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "rgb(100 116 139)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as DayData
                  return (
                    <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 px-4 py-3 shadow-xl">
                      <p className="text-xs text-slate-500">{p.label}</p>
                      <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                        {p.count} platform events
                      </p>
                    </div>
                  )
                }}
              />
              <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: "#6366f1" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
