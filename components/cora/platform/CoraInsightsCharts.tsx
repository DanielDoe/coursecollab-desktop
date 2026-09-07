"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "@/lib/utils"

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function WeeklyActivityChart({
  weeklyPattern,
  className,
}: {
  weeklyPattern?: Record<number, number>
  className?: string
}) {
  const data = DAY_LABELS.map((label, index) => ({
    day: label,
    sessions: weeklyPattern?.[index] ?? 0,
  }))
  const hasData = data.some((d) => d.sessions > 0)

  if (!hasData) {
    return (
      <p className={cn("text-sm text-[var(--cc-text-muted)] rounded-xl bg-[var(--muted)]/30 px-4 py-6 text-center", className)}>
        Chat or Solve with Cora this week to see your activity pattern.
      </p>
    )
  }

  return (
    <div className={cn("h-44 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--cc-text-muted)" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--cc-text-muted)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 12,
            }}
          />
          <Bar dataKey="sessions" fill="var(--cc-accent)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function InteractionMixChart({
  conceptQuestions = 0,
  debugQuestions = 0,
  className,
}: {
  conceptQuestions?: number
  debugQuestions?: number
  className?: string
}) {
  const total = conceptQuestions + debugQuestions
  const data = [
    { name: "Chat / concepts", value: conceptQuestions, color: "#8b5cf6" },
    { name: "Solve / debug", value: debugQuestions, color: "#10b981" },
  ].filter((d) => d.value > 0)

  if (total === 0) {
    return (
      <p className={cn("text-sm text-[var(--cc-text-muted)] rounded-xl bg-[var(--muted)]/30 px-4 py-6 text-center", className)}>
        Cora will show how you split Chat vs Solve-style questions here.
      </p>
    )
  }

  return (
    <div className={cn("flex flex-col sm:flex-row items-center gap-4", className)}>
      <div className="h-36 w-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={36} outerRadius={56} paddingAngle={2}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2 text-sm min-w-0">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-[var(--cc-text)]">{item.name}</span>
            <span className="tabular-nums text-[var(--cc-text-muted)] ml-auto">
              {Math.round((item.value / total) * 100)}%
            </span>
          </div>
        ))}
        <p className="text-xs text-[var(--cc-text-muted)] pt-1">
          {total} tracked interaction{total === 1 ? "" : "s"} in the last 30 days
        </p>
      </div>
    </div>
  )
}

export function ReasoningTrendChart({
  history,
  className,
}: {
  history: { week: string; score: number }[]
  className?: string
}) {
  if (history.length === 0) return null

  return (
    <div className={cn("h-36 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
          <XAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--cc-text-muted)" }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--cc-text-muted)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 12,
            }}
          />
          <Line type="monotone" dataKey="score" stroke="var(--cc-accent)" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TopicMasteryChart({
  topics,
  className,
}: {
  topics: { topic: string; mastery: number }[]
  className?: string
}) {
  const rows = topics.slice(0, 6)
  if (rows.length === 0) {
    return (
      <p className={cn("text-sm text-[var(--cc-text-muted)] rounded-xl bg-[var(--muted)]/30 px-4 py-6 text-center", className)}>
        Topics appear here as you use Solve and Chat.
      </p>
    )
  }

  return (
    <div className={cn("h-44 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.5} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--cc-text-muted)" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="topic"
            width={88}
            tick={{ fontSize: 10, fill: "var(--cc-text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip />
          <Bar dataKey="mastery" fill="var(--cc-accent)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
