"use client"

import { useState, useEffect } from "react"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { cn } from "@/lib/utils"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"

interface BreakdownItem {
  name: string
  value: number
  type: string
  [key: string]: string | number
}

const COLORS = ["var(--cc-success)", "var(--cc-accent)", "var(--cc-accent-dark)", "var(--cc-warning)"]

export function AssessmentBreakdownChart() {
  const { courseScopeVersion, portal } = useInstructorDashboardV2()
  const [data, setData] = useState<BreakdownItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const url =
      portal === "admin" ? "/api/admin/dashboard/charts" : "/api/instructor/dashboard/charts"
    const headers = portal === "admin" ? buildAdminApiHeaders() : buildInstructorApiHeaders()
    fetch(url, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.assessmentBreakdown) setData(j.assessmentBreakdown)
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
    payload?: { name: string; value: number; payload: BreakdownItem }[]
  }) => {
    if (!active || !payload?.length) return null
    const p = payload[0].payload
    const total = data.reduce((s, d) => s + d.value, 0)
    const pct = total > 0 ? Math.round((p.value / total) * 100) : 0
    return (
      <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-3 shadow-xl">
        <p className="text-sm font-medium text-slate-900 dark:text-white">{p.name}</p>
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{p.value} submissions ({pct}%)</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={cn("p-5 sm:p-6 rounded-2xl sm:rounded-3xl", "bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl",
        "border border-slate-200/60 dark:border-white/[0.08]",
        "shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.35)]")}>
        <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-6">Submissions by Type</h3>
        <div className="h-[260px] animate-pulse bg-slate-200/30 dark:bg-white/5 rounded-xl" />
      </div>
    )
  }

  const hasData = data.some((d) => d.value > 0)

  return (
    <div className={cn("p-5 sm:p-6 rounded-2xl sm:rounded-3xl", "bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl",
      "border border-slate-200/60 dark:border-white/[0.08]",
      "shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.35)]")}>
      <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white mb-6">
        Submissions by Type
      </h3>
      {!hasData ? (
        <div className="h-[260px] flex items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
          <p className="text-sm text-slate-500 dark:text-slate-400">No submissions yet</p>
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_, i) => (
                  <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value, entry) => (
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    {value}: {entry.payload?.value ?? 0}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
