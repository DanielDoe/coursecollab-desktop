"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "@/lib/utils"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
}

export function ScoreTrendChart({
  data,
  className,
}: {
  data: Array<{ date: string; score: number }>
  className?: string
}) {
  const { accent } = useCodebenchChrome()
  if (!data.length) {
    return (
      <p className={cn("rounded-xl bg-[var(--muted)]/30 px-4 py-8 text-center text-sm", PORTAL_TEXT_MUTED, className)}>
        Submit evaluated work to unlock your score trend.
      </p>
    )
  }

  return (
    <div className={cn("h-52 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="cbScoreFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--cc-text-muted)" }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--cc-text-muted)" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Area type="monotone" dataKey="score" stroke={accent} fill="url(#cbScoreFill)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ActivityWeekChart({
  data,
  className,
}: {
  data: Array<{ day: string; count: number }>
  className?: string
}) {
  const { accent } = useCodebenchChrome()
  const hasData = data.some((d) => d.count > 0)
  if (!hasData) {
    return (
      <p className={cn("rounded-xl bg-[var(--muted)]/30 px-4 py-8 text-center text-sm", PORTAL_TEXT_MUTED, className)}>
        Activity by weekday appears after you submit this month.
      </p>
    )
  }

  return (
    <div className={cn("h-52 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--cc-text-muted)" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--cc-text-muted)" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="count" fill={accent} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ConceptRadarChart({
  concepts,
  className,
}: {
  concepts: Record<string, number>
  className?: string
}) {
  const { accent, soft } = useCodebenchChrome()
  const data = [
    { concept: "Loops", value: concepts.loops ?? 0 },
    { concept: "Pointers", value: concepts.pointers ?? 0 },
    { concept: "OOP", value: concepts.oop ?? 0 },
    { concept: "Recursion", value: concepts.recursion ?? 0 },
    { concept: "Arrays", value: concepts.arrays ?? 0 },
    { concept: "STL", value: concepts.stl ?? 0 },
  ]
  const hasData = data.some((d) => d.value > 0)
  if (!hasData) {
    return (
      <p className={cn("rounded-xl bg-[var(--muted)]/30 px-4 py-8 text-center text-sm", PORTAL_TEXT_MUTED, className)}>
        Cora will map concept proficiency after reviewing your submissions.
      </p>
    )
  }

  return (
    <div className={cn("h-64 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="concept" tick={{ fontSize: 11, fill: "var(--cc-text-muted)" }} />
          <Radar name="Mastery" dataKey="value" stroke={accent} fill={soft} fillOpacity={0.45} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StatusMixChart({
  data,
  className,
}: {
  data: Array<{ name: string; value: number }>
  className?: string
}) {
  const { accent, mid, deep, soft } = useCodebenchChrome()
  const palette = [accent, mid, soft, deep]
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) {
    return (
      <p className={cn("rounded-xl bg-[var(--muted)]/30 px-4 py-8 text-center text-sm", PORTAL_TEXT_MUTED, className)}>
        Status mix unlocks once submissions are graded.
      </p>
    )
  }

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="h-36 w-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={34} outerRadius={52} paddingAngle={2}>
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={palette[i % palette.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 space-y-1.5 text-sm">
        {data.map((entry, i) => (
          <li key={entry.name} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: palette[i % palette.length] }} />
            <span className="truncate capitalize text-[var(--cc-text)]">{entry.name}</span>
            <span className={cn("ml-auto tabular-nums", PORTAL_TEXT_MUTED)}>{entry.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function WorkshopMixChart({
  data,
  className,
}: {
  data: Array<{ name: string; value: number }>
  className?: string
}) {
  const { accent } = useCodebenchChrome()
  const hasData = data.some((d) => d.value > 0)
  if (!hasData) {
    return (
      <p className={cn("rounded-xl bg-[var(--muted)]/30 px-4 py-8 text-center text-sm", PORTAL_TEXT_MUTED, className)}>
        Editor runs and Cora asks will show up here.
      </p>
    )
  }

  return (
    <div className={cn("h-52 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--cc-text-muted)" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--cc-text-muted)" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" fill={accent} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ConceptBarsChart({
  concepts,
  className,
}: {
  concepts: Record<string, number>
  className?: string
}) {
  const { accent } = useCodebenchChrome()
  const data = [
    { name: "Loops", value: concepts.loops ?? 0 },
    { name: "Pointers", value: concepts.pointers ?? 0 },
    { name: "OOP", value: concepts.oop ?? 0 },
    { name: "Recursion", value: concepts.recursion ?? 0 },
    { name: "Arrays", value: concepts.arrays ?? 0 },
    { name: "STL", value: concepts.stl ?? 0 },
  ]

  return (
    <div className={cn("h-56 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.45} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--cc-text-muted)" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11, fill: "var(--cc-text-muted)" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" fill={accent} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
