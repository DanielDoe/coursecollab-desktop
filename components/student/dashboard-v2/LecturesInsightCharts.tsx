"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "@/lib/utils"
import { useLectureChrome } from "@/hooks/use-lecture-chrome"

export function LectureProgressDonut({
  completed,
  inProgress,
  notStarted,
  className,
}: {
  completed: number
  inProgress: number
  notStarted: number
  className?: string
}) {
  const { chart } = useLectureChrome()
  const total = completed + inProgress + notStarted
  const data = [
    { name: "Done", value: completed, color: chart.completed },
    { name: "Active", value: inProgress, color: chart.inProgress },
    { name: "Not started", value: notStarted, color: chart.notStarted },
  ].filter((d) => d.value > 0)

  if (total === 0) {
    return (
      <p className={cn("text-xs text-[var(--cc-text-muted)] text-center py-4", className)}>
        No lectures yet
      </p>
    )
  }

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="h-28 w-28 shrink-0 sm:h-32 sm:w-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={26} outerRadius={40} paddingAngle={2}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 11,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="min-w-0 space-y-1.5 text-[11px]">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[var(--cc-text-muted)]">{item.name}</span>
            <span className="ml-auto tabular-nums font-medium text-[var(--cc-text)]">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LectureWeeklyViewsChart({
  weeklyViews,
  className,
}: {
  weeklyViews: { label: string; views: number }[]
  className?: string
}) {
  const { chart } = useLectureChrome()
  const hasData = weeklyViews.some((d) => d.views > 0)

  if (!hasData) {
    return (
      <p className={cn("text-xs text-[var(--cc-text-muted)] rounded-lg bg-[var(--muted)]/30 px-3 py-5 text-center", className)}>
        Class lecture opens will appear here once activity starts.
      </p>
    )
  }

  return (
    <div className={cn("h-28 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={weeklyViews} margin={{ top: 2, right: 2, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.45} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--cc-text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--cc-text-muted)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 11,
            }}
          />
          <Bar dataKey="views" fill={chart.views} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ClassWeekEngagementChart({
  weeks,
  className,
}: {
  weeks: { week: number; completed: number; active: number }[]
  className?: string
}) {
  const { chart } = useLectureChrome()
  const data = weeks.map((w) => ({
    week: `W${w.week}`,
    completed: w.completed,
    active: w.active,
  }))

  if (data.length === 0) {
    return null
  }

  return (
    <div className={cn("h-28 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 2, right: 2, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.45} />
          <XAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--cc-text-muted)" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--cc-text-muted)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 11,
            }}
          />
          <Bar dataKey="completed" stackId="a" fill={chart.completed} radius={[0, 0, 0, 0]} />
          <Bar dataKey="active" stackId="a" fill={chart.active} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
