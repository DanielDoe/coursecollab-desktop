"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { BarChart3, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

const chrome = facultyEmbedChrome("practice")
const fp = chrome.p

type TopicRow = {
  topic: string
  attempts: number
  avgScore: number
  uniqueStudents: number
}

type DayRow = {
  date: string
  attempts: number
  avgScore: number | null
}

function shortTopic(name: string): string {
  const cleaned = name.replace(/^Chapter\s+\d+:\s*/i, "")
  return cleaned.length > 22 ? `${cleaned.slice(0, 21)}…` : cleaned
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: Record<string, unknown> }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload ?? {}
  const title = typeof row.fullTopic === "string" ? row.fullTopic : label
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 shadow-md">
      <p className={cn("max-w-[220px] text-xs font-semibold", PORTAL_TEXT)}>{title}</p>
      <div className="mt-1.5 space-y-0.5">
        {payload.map((item) => (
          <p key={item.name} className={cn("text-[11px] tabular-nums", PORTAL_TEXT_MUTED)}>
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
            {item.name}: {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
          </p>
        ))}
        {typeof row.uniqueStudents === "number" ? (
          <p className={cn("text-[11px] tabular-nums", PORTAL_TEXT_MUTED)}>
            Students: {row.uniqueStudents}
          </p>
        ) : null}
        {typeof row.avgScore === "number" && row.fullTopic ? (
          <p className={cn("text-[11px] tabular-nums", PORTAL_TEXT_MUTED)}>
            Avg score: {Number(row.avgScore).toFixed(0)}%
          </p>
        ) : null}
      </div>
    </div>
  )
}

function padDailyTrends(rows: DayRow[]): DayRow[] {
  const byLabel = new Map(rows.map((row) => [row.date, row]))
  const out: DayRow[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const existing = byLabel.get(label)
    out.push(existing ?? { date: label, attempts: 0, avgScore: null })
  }
  return out
}

export function PracticeAnalyticsCharts({
  topicPerformance,
  dailyTrends,
}: {
  topicPerformance: TopicRow[]
  dailyTrends: DayRow[]
}) {
  const topicData = [...topicPerformance]
    .filter((t) => t.attempts > 0)
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 8)
    .map((t) => ({
      ...t,
      label: shortTopic(t.topic),
      fullTopic: t.topic,
    }))
    .reverse()

  const dayData = padDailyTrends(dailyTrends)
  const topicHeight = Math.max(220, topicData.length * 36 + 16)

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <section className={cn(PORTAL_CARD, "p-4 sm:p-5")}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className={cn("flex items-center gap-2 text-sm font-semibold", PORTAL_TEXT)}>
              <TrendingUp className={cn("h-4 w-4", fp.iconText)} />
              Topic performance
            </h3>
            <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>Top topics by attempts</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[var(--cc-accent)]" />
            Attempts
          </span>
        </div>
        {topicData.length === 0 ? (
          <p className={cn("py-10 text-center text-sm", PORTAL_TEXT_MUTED)}>No topic attempts yet</p>
        ) : (
          <div style={{ height: topicHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topicData} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "var(--cc-text-muted)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={118}
                  tick={{ fill: "var(--cc-text)", fontSize: 11, fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip cursor={{ fill: "color-mix(in srgb, var(--cc-accent) 8%, transparent)" }} content={<ChartTooltip />} />
                <Bar dataKey="attempts" name="Attempts" fill="var(--cc-accent)" radius={[0, 8, 8, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className={cn(PORTAL_CARD, "p-4 sm:p-5")}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className={cn("flex items-center gap-2 text-sm font-semibold", PORTAL_TEXT)}>
              <BarChart3 className={cn("h-4 w-4", fp.iconText)} />
              Daily trends
            </h3>
            <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>Last 14 days</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--cc-accent)]" />
              Attempts
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--cc-success)]" />
              Avg %
            </span>
          </div>
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                interval={2}
                tick={{ fill: "var(--cc-text-muted)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="attempts"
                allowDecimals={false}
                tick={{ fill: "var(--cc-text-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <YAxis
                yAxisId="score"
                orientation="right"
                domain={[0, 100]}
                tick={{ fill: "var(--cc-text-muted)", fontSize: 11 }}
                tickFormatter={(v) => `${v}`}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "color-mix(in srgb, var(--cc-accent) 8%, transparent)" }} />
              <Bar
                yAxisId="attempts"
                dataKey="attempts"
                name="Attempts"
                fill="var(--cc-accent)"
                radius={[6, 6, 0, 0]}
                barSize={14}
              />
              <Line
                yAxisId="score"
                type="monotone"
                dataKey="avgScore"
                name="Avg score %"
                stroke="var(--cc-success)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--cc-success)", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
