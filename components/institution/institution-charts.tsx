"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useTheme } from "@/hooks/use-theme"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { downloadChartCsv, downloadChartPng, type ChartExportRow } from "@/lib/institutions/chart-export"
import type { InstitutionNamedCount, InstitutionWeekPoint } from "@/lib/institutions/insights"
import {
  INSTITUTION_CHART_FILLS,
  INSTITUTION_CHART_PRIMARY,
  INSTITUTION_CHART_SECONDARY,
  INSTITUTION_STACKED_ACTIVITY_FILLS,
  INSTITUTION_TRAJECTORY_FILLS,
  institutionChartFill,
} from "@/lib/institution-chart-theme"


const CHART_LABEL_MAX = 26

function truncateChartLabel(label: string, max = CHART_LABEL_MAX): string {
  const trimmed = label.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function chartCategoryAxisWidth(labels: string[], max = CHART_LABEL_MAX): number {
  const longest = labels.reduce((n, label) => Math.max(n, truncateChartLabel(label, max).length), 0)
  return Math.min(176, Math.max(108, Math.round(longest * 6.2 + 16)))
}

function verticalBarChartHeight(rowCount: number): number {
  return Math.min(440, Math.max(CHART_HEIGHT, rowCount * 30 + 28))
}

function PieLegendList({ data }: { data: InstitutionNamedCount[] }) {
  return (
    <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto overscroll-y-contain pr-1">
      {data.map((row, i) => (
        <li key={row.key} className="flex min-w-0 items-start gap-2 text-xs leading-snug">
          <span
            className="mt-1 size-2 shrink-0 rounded-full"
            style={{ background: INSTITUTION_CHART_FILLS[i % INSTITUTION_CHART_FILLS.length] }}
            aria-hidden
          />
          <span className={cn("min-w-0 flex-1 break-words", PORTAL_TEXT)}>{row.name}</span>
          <span className={cn("shrink-0 tabular-nums", PORTAL_TEXT_MUTED)}>{row.value.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  )
}

const CHART_HEIGHT = 220
const CHART_HEIGHT_LG = 248

function InstitutionChartFrame({
  height = CHART_HEIGHT,
  className,
  children,
}: {
  height?: number
  className?: string
  children: (size: { width: number; height: number }) => ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const width = el.clientWidth
      const heightPx = el.clientHeight
      if (width > 0 && heightPx > 0) {
        setSize((prev) =>
          prev?.width === width && prev?.height === heightPx ? prev : { width, height: heightPx },
        )
      }
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} className={cn("w-full min-w-0", className)} style={{ height }}>
      {size ? children(size) : null}
    </div>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 shadow-lg">
      {label ? <p className={cn("mb-1 text-xs font-medium", PORTAL_TEXT)}>{label}</p> : null}
      {payload.map((item) => (
        <p key={item.name} className="text-xs tabular-nums text-[var(--cc-text-secondary)]">
          <span className="mr-1.5 inline-block size-1.5 rounded-full" style={{ background: item.color }} />
          {item.name}: {Number(item.value ?? 0).toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export function InstitutionChartCard({
  title,
  hint,
  children,
  className,
  exportFilename,
  exportRows,
  exportValueHeader = "value",
  enablePngExport = true,
}: {
  title: string
  hint?: string
  children: ReactNode
  className?: string
  exportFilename?: string
  exportRows?: ChartExportRow[]
  exportValueHeader?: string
  enablePngExport?: boolean
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const slug =
    exportFilename ??
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  return (
    <div className={cn(PORTAL_CARD, "p-4 sm:p-5", className)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">{title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {exportRows && exportRows.length > 0 ? (
            <button
              type="button"
              className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--cc-text-secondary)] hover:bg-[var(--muted)]/40"
              onClick={() => downloadChartCsv(slug, exportRows, exportValueHeader)}
            >
              CSV
            </button>
          ) : null}
          {enablePngExport ? (
            <button
              type="button"
              className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--cc-text-secondary)] hover:bg-[var(--muted)]/40"
              onClick={() => void downloadChartPng(chartRef.current, slug)}
            >
              PNG
            </button>
          ) : null}
          {hint ? <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{hint}</p> : null}
        </div>
      </div>
      <div ref={chartRef}>{children}</div>
    </div>
  )
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/30 px-4 text-center">
      <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>{message}</p>
    </div>
  )
}

export function CoraActivityChart({ data }: { data: InstitutionWeekPoint[]; hasActivity?: boolean }) {
  const uid = useId().replace(/:/g, "")
  const { theme } = useTheme()
  const tickFill = theme === "dark" ? "rgb(148 163 184)" : "rgb(100 116 139)"
  const dotStroke = theme === "dark" ? "rgb(30 41 59)" : "#fff"
  const creditsId = `instCoraCredits-${uid}`

  return (
    <div>
      <InstitutionChartFrame height={CHART_HEIGHT_LG}>
        {({ width, height }) => (
          <ResponsiveContainer width={width} height={height}>
          <ComposedChart data={data} margin={{ top: 10, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={creditsId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={INSTITUTION_CHART_PRIMARY} stopOpacity={0.28} />
                <stop offset="100%" stopColor={INSTITUTION_CHART_PRIMARY} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" vertical={false} />
            <XAxis
              dataKey="label"
              interval="preserveStartEnd"
              minTickGap={28}
              tick={{ fill: tickFill, fontSize: 11, fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="credits"
              tick={{ fill: tickFill, fontSize: 11, fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={44}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))}
            />
            <YAxis
              yAxisId="jobs"
              orientation="right"
              tick={{ fill: tickFill, fontSize: 11, fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={32}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgb(148 163 184 / 0.3)", strokeWidth: 1 }} />
            <Area
              yAxisId="credits"
              type="monotone"
              dataKey="credits"
              name="Cora credits"
              stroke={INSTITUTION_CHART_PRIMARY}
              strokeWidth={2.5}
              fill={`url(#${creditsId})`}
              dot={{ r: 3.5, fill: INSTITUTION_CHART_PRIMARY, strokeWidth: 2, stroke: dotStroke }}
              activeDot={{ r: 6, fill: INSTITUTION_CHART_PRIMARY, strokeWidth: 2, stroke: dotStroke }}
            />
            <Line
              yAxisId="jobs"
              type="monotone"
              dataKey="workflows"
              name="Workflows"
              stroke={INSTITUTION_CHART_SECONDARY}
              strokeWidth={2}
              dot={{ r: 3, fill: INSTITUTION_CHART_SECONDARY, strokeWidth: 2, stroke: dotStroke }}
              activeDot={{ r: 5, fill: INSTITUTION_CHART_SECONDARY, strokeWidth: 2, stroke: dotStroke }}
            />
          </ComposedChart>
          </ResponsiveContainer>
        )}
      </InstitutionChartFrame>
      <div className="mt-3 flex flex-wrap items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: INSTITUTION_CHART_PRIMARY }} />
          <span className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Cora credits</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full" style={{ background: INSTITUTION_CHART_SECONDARY }} />
          <span className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Workflows</span>
        </div>
      </div>
    </div>
  )
}

export function ActiveUsersChart({ data }: { data: InstitutionWeekPoint[]; hasActivity?: boolean }) {
  const uid = useId().replace(/:/g, "")
  const { theme } = useTheme()
  const tickFill = theme === "dark" ? "rgb(148 163 184)" : "rgb(100 116 139)"
  const dotStroke = theme === "dark" ? "rgb(30 41 59)" : "#fff"
  const fillId = `instActiveUsers-${uid}`
  return (
    <InstitutionChartFrame>
      {({ width, height }) => (
        <ResponsiveContainer width={width} height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={INSTITUTION_CHART_SECONDARY} stopOpacity={0.28} />
              <stop offset="100%" stopColor={INSTITUTION_CHART_SECONDARY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" vertical={false} />
          <XAxis
            dataKey="label"
            interval="preserveStartEnd"
            minTickGap={28}
            tick={{ fill: tickFill, fontSize: 11, fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: tickFill, fontSize: 11, fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgb(148 163 184 / 0.3)", strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="activeUsers"
            name="Active users"
            stroke={INSTITUTION_CHART_SECONDARY}
            strokeWidth={2.5}
            fill={`url(#${fillId})`}
            dot={{ r: 3.5, fill: INSTITUTION_CHART_SECONDARY, strokeWidth: 2, stroke: dotStroke }}
            activeDot={{ r: 6, fill: INSTITUTION_CHART_SECONDARY, strokeWidth: 2, stroke: dotStroke }}
          />
        </ComposedChart>
        </ResponsiveContainer>
      )}
    </InstitutionChartFrame>
  )
}

export function MixPieChart({
  data,
  empty,
}: {
  data: InstitutionNamedCount[]
  empty: string
}) {
  const total = data.reduce((sum, row) => sum + row.value, 0)
  if (total <= 0) {
    return (
      <div className="relative">
        <InstitutionChartFrame className="opacity-40">
          {({ width, height }) => (
            <ResponsiveContainer width={width} height={height}>
              <PieChart>
                <Pie data={[{ name: "None", value: 1 }]} dataKey="value" innerRadius={58} outerRadius={86} stroke="var(--card)">
                  <Cell fill="color-mix(in srgb, var(--cc-text) 18%, transparent)" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </InstitutionChartFrame>
        <p className={cn("pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center text-sm", PORTAL_TEXT_MUTED)}>
          {empty}
        </p>
      </div>
    )
  }
  return (
    <div className="min-w-0">
      <InstitutionChartFrame height={168}>
        {({ width, height }) => (
          <ResponsiveContainer width={width} height={height}>
            <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} stroke="var(--card)">
                {data.map((row, i) => (
                  <Cell key={row.key} fill={INSTITUTION_CHART_FILLS[i % INSTITUTION_CHART_FILLS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </InstitutionChartFrame>
      <PieLegendList data={data} />
    </div>
  )
}

export function NamedBarChart({
  data,
  empty,
  valueLabel = "Count",
}: {
  data: InstitutionNamedCount[]
  empty: string
  valueLabel?: string
}) {
  const total = data.reduce((sum, row) => sum + row.value, 0)
  if (total <= 0) return <ChartEmpty message={empty} />
  const labels = data.map((row) => row.name)
  const yAxisWidth = chartCategoryAxisWidth(labels)
  const chartHeight = verticalBarChartHeight(data.length)
  return (
    <InstitutionChartFrame height={chartHeight}>
      {({ width, height }) => (
        <ResponsiveContainer width={width} height={height}>
          <ComposedChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--cc-text) 12%, transparent)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "var(--cc-text-muted)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={yAxisWidth}
              tick={{ fill: "var(--cc-text-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => truncateChartLabel(String(value))}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="value" name={valueLabel} radius={[0, 8, 8, 0]} maxBarSize={22}>
              {data.map((row, i) => (
                <Cell key={row.key} fill={institutionChartFill(i)} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </InstitutionChartFrame>
  )
}

export function SeatRadial({ used, limit }: { used: number; limit: number | null }) {
  const cap = limit && limit > 0 ? limit : 0
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0
  const data = [{ name: "Seats", value: Math.max(pct, cap > 0 ? pct : 0.01), fill: INSTITUTION_CHART_PRIMARY }]
  return (
    <div className="relative w-full min-w-0">
      <InstitutionChartFrame>
        {({ width, height }) => (
          <ResponsiveContainer width={width} height={height}>
            <RadialBarChart innerRadius="62%" outerRadius="96%" data={data} startAngle={90} endAngle={-270}>
              <RadialBar
                dataKey="value"
                cornerRadius={10}
                background={{ fill: "color-mix(in srgb, var(--cc-text) 8%, transparent)" }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        )}
      </InstitutionChartFrame>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className={cn("text-3xl font-semibold tabular-nums", PORTAL_TEXT)}>{pct}%</p>
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          {cap > 0 ? `${used.toLocaleString()} / ${cap.toLocaleString()} seats` : "No seat cap yet"}
        </p>
      </div>
    </div>
  )
}


type CourseMetricRow = {
  courseId: number
  courseCode: string
  courseName: string
  activeStudents: number
  completionRate: number | null
  coraAdoptionRate: number | null
}

function courseMetricBarWidth(value: number | null, max: number): number {
  if (value == null || value <= 0 || max <= 0) return 0
  return Math.max(4, Math.min(100, Math.round((value / max) * 100)))
}


export function CourseMetricChart({
  data,
  empty,
  valueLabel = "Value",
  valueSuffix = "",
  domainMax,
  colorOffset = 0,
}: {
  data: InstitutionNamedCount[]
  empty: string
  valueLabel?: string
  valueSuffix?: string
  domainMax?: number
  colorOffset?: number
}) {
  const { theme } = useTheme()
  const tickFill = theme === "dark" ? "rgb(148 163 184)" : "rgb(100 116 139)"
  const hasValues = data.some((row) => row.value > 0)
  if (!hasValues) return <ChartEmpty message={empty} />

  const chartHeight = Math.max(176, Math.min(248, 148 + data.length * 10))

  return (
    <InstitutionChartFrame height={chartHeight}>
      {({ width, height }) => (
        <ResponsiveContainer width={width} height={height}>
          <ComposedChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--cc-text) 10%, transparent)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: tickFill, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={0}
              tickFormatter={(value) => truncateChartLabel(String(value), 14)}
            />
            <YAxis
              domain={domainMax != null ? [0, domainMax] : [0, "auto"]}
              tick={{ fill: tickFill, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={domainMax == null}
              width={34}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="value" name={valueLabel} maxBarSize={44} radius={[6, 6, 0, 0]}>
              {data.map((row, i) => (
                <Cell key={row.key} fill={institutionChartFill(colorOffset + i)} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={(value) => `${value ?? ""}${valueSuffix}`}
                style={{ fill: tickFill, fontSize: 10, fontWeight: 600 }}
              />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </InstitutionChartFrame>
  )
}

type CoursePerformanceRow = {
  courseId: number
  courseCode: string
  courseName: string
  activeStudents: number
  completionRate: number | null
  coraAdoptionRate: number | null
}

export function CoursePerformanceGroupedChart({ rows }: { rows: CoursePerformanceRow[] }) {
  const { theme } = useTheme()
  const tickFill = theme === "dark" ? "rgb(148 163 184)" : "rgb(100 116 139)"
  if (rows.length === 0) return <ChartEmpty message="No course data in this period" />

  const maxActive = Math.max(1, ...rows.map((row) => row.activeStudents))
  const data = rows.map((row) => ({
    key: String(row.courseId),
    name: row.courseCode || row.courseName,
    engagementIndex: Math.round((row.activeStudents / maxActive) * 100),
    completion: row.completionRate ?? 0,
    cora: row.coraAdoptionRate ?? 0,
    activeStudents: row.activeStudents,
  }))

  return (
    <div className="min-w-0">
      <InstitutionChartFrame height={rows.length > 3 ? 260 : 220}>
        {({ width, height }) => (
          <ResponsiveContainer width={width} height={height}>
            <ComposedChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="18%">
              <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--cc-text) 10%, transparent)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: tickFill, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={0}
                tickFormatter={(value) => truncateChartLabel(String(value), 12)}
              />
              <YAxis domain={[0, 100]} tick={{ fill: tickFill, fontSize: 10 }} tickLine={false} axisLine={false} width={32} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const row = data.find((d) => d.name === label)
                  return (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 shadow-lg">
                      <p className={cn("mb-1 text-xs font-medium", PORTAL_TEXT)}>{label}</p>
                      {payload.map((item) => (
                        <p key={item.name} className="text-xs tabular-nums text-[var(--cc-text-secondary)]">
                          <span className="mr-1.5 inline-block size-1.5 rounded-full" style={{ background: item.color }} />
                          {item.name}: {item.name === "Engagement index" && row ? `${item.value}% (${row.activeStudents} active)` : `${item.value}%`}
                        </p>
                      ))}
                    </div>
                  )
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "var(--cc-text-muted)", paddingTop: 8 }}
                formatter={(value) => (value === "Engagement index" ? "Engagement (indexed)" : value)}
              />
              <Bar dataKey="engagementIndex" name="Engagement index" fill={INSTITUTION_STACKED_ACTIVITY_FILLS.assessments} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="completion" name="Completion" fill={INSTITUTION_STACKED_ACTIVITY_FILLS.practice} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="cora" name="Cora adoption" fill={INSTITUTION_STACKED_ACTIVITY_FILLS.coraLearning} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </InstitutionChartFrame>
      <p className={cn("mt-2 text-xs", PORTAL_TEXT_MUTED)}>
        Engagement index scales active students relative to the highest-enrolled course (0–100%).
      </p>
    </div>
  )
}

export function CourseMetricsComparison({ rows }: { rows: CourseMetricRow[] }) {
  if (rows.length === 0) return <ChartEmpty message="No course data in this period" />

  const maxActive = Math.max(1, ...rows.map((row) => row.activeStudents))
  const metrics = [
    {
      id: "engagement",
      label: "Active students",
      color: INSTITUTION_CHART_FILLS[0],
      value: (row: CourseMetricRow) => row.activeStudents,
      display: (value: number) => value.toLocaleString(),
      width: (row: CourseMetricRow) => courseMetricBarWidth(row.activeStudents, maxActive),
    },
    {
      id: "completion",
      label: "Completion rate",
      color: INSTITUTION_CHART_FILLS[1],
      value: (row: CourseMetricRow) => row.completionRate,
      display: (value: number) => `${value}%`,
      width: (row: CourseMetricRow) => courseMetricBarWidth(row.completionRate, 100),
    },
    {
      id: "cora",
      label: "Cora adoption",
      color: INSTITUTION_CHART_FILLS[4],
      value: (row: CourseMetricRow) => row.coraAdoptionRate,
      display: (value: number) => `${value}%`,
      width: (row: CourseMetricRow) => courseMetricBarWidth(row.coraAdoptionRate, 100),
    },
  ] as const

  if (rows.length === 1) {
    const row = rows[0]!
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map((metric) => {
          const raw = metric.value(row)
          const display = raw == null ? "—" : metric.display(raw)
          return (
            <div
              key={metric.id}
              className="rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_92%,var(--muted))] p-4"
            >
              <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", PORTAL_TEXT_MUTED)}>
                {metric.label}
              </p>
              <p className={cn("mt-2 text-3xl font-semibold tabular-nums tracking-tight", PORTAL_TEXT)}>{display}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${metric.width(row)}%`, background: metric.color }}
                />
              </div>
              <p className={cn("mt-3 truncate text-xs font-medium", PORTAL_TEXT_MUTED)}>
                {row.courseCode || row.courseName}
              </p>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
      {rows.map((row) => (
        <div key={row.courseId} className="p-4 sm:p-5">
          <div className="mb-4 min-w-0">
            <p className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>{row.courseCode || row.courseName}</p>
            {row.courseName && row.courseCode ? (
              <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)}>{row.courseName}</p>
            ) : null}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {metrics.map((metric) => {
              const raw = metric.value(row)
              const display = raw == null ? "—" : metric.display(raw)
              return (
                <div key={metric.id} className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                    <span className={PORTAL_TEXT_MUTED}>{metric.label}</span>
                    <span className={cn("shrink-0 tabular-nums font-semibold", PORTAL_TEXT)}>{display}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${metric.width(row)}%`, background: metric.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function CoverageBars({
  students,
  instructors,
  courses,
}: {
  students: number
  instructors: number
  courses: number
}) {
  const data = [
    { name: "Students", value: students, key: "students" },
    { name: "Faculty", value: instructors, key: "faculty" },
    { name: "Courses", value: courses, key: "courses" },
  ]
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="space-y-3">
      {data.map((row, i) => (
        <div key={row.key}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className={PORTAL_TEXT_MUTED}>{row.name}</span>
            <span className={cn("tabular-nums font-medium", PORTAL_TEXT)}>{row.value.toLocaleString()}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(row.value > 0 ? 6 : 0, Math.round((row.value / max) * 100))}%`,
                background: INSTITUTION_CHART_FILLS[i],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function UtilizationMeter({
  used,
  limit,
  statusLabel,
}: {
  used: number
  limit: number | null
  statusLabel?: string
}) {
  const cap = limit && limit > 0 ? limit : 0
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 1000) / 10) : 0
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
          {cap > 0 ? `${used.toLocaleString()} / ${cap.toLocaleString()} active learners` : `${used.toLocaleString()} active learners`}
        </p>
        {cap > 0 ? <p className={cn("text-sm tabular-nums font-semibold", PORTAL_TEXT)}>{pct}% utilized</p> : null}
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[var(--muted)]" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full transition-all" style={{ background: INSTITUTION_CHART_PRIMARY, width: `${cap > 0 ? pct : 0}%` }} />
      </div>
      {statusLabel ? <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{statusLabel}</p> : null}
    </div>
  )
}

export type ActivityWeekPoint = {
  label: string
  assessments: number
  practice: number
  coding: number
  coraLearning: number
}

export function StackedActivityChart({ data }: { data: ActivityWeekPoint[] }) {
  const { theme } = useTheme()
  const tickFill = theme === "dark" ? "rgb(148 163 184)" : "rgb(100 116 139)"
  const total = data.reduce((s, d) => s + d.assessments + d.practice + d.coding + d.coraLearning, 0)
  if (total <= 0) return <ChartEmpty message="No academic activity during this period" />
  return (
    <InstitutionChartFrame height={CHART_HEIGHT_LG}>
      {({ width, height }) => (
        <ResponsiveContainer width={width} height={height}>
          <ComposedChart data={data} margin={{ top: 10, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: tickFill, fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: tickFill, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="assessments" name="Assessments" stackId="a" fill={INSTITUTION_STACKED_ACTIVITY_FILLS.assessments} radius={[0, 0, 0, 0]} />
            <Bar dataKey="practice" name="Practice" stackId="a" fill={INSTITUTION_STACKED_ACTIVITY_FILLS.practice} />
            <Bar dataKey="coding" name="Coding" stackId="a" fill={INSTITUTION_STACKED_ACTIVITY_FILLS.coding} />
            <Bar dataKey="coraLearning" name="Cora learning" stackId="a" fill={INSTITUTION_STACKED_ACTIVITY_FILLS.coraLearning} radius={[4, 4, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </InstitutionChartFrame>
  )
}

export function TrajectoryStackedChart({
  data,
}: {
  data: Array<{
    label: string
    notAttempted: number
    emerging: number
    developing: number
    proficient: number
    mastered: number
  }>
}) {
  const rows = data.map((d) => {
    const attempted = d.emerging + d.developing + d.proficient + d.mastered
    const roster = attempted + d.notAttempted
    return {
      ...d,
      attempted,
      roster,
      attemptRate: roster > 0 ? Math.round((attempted / roster) * 1000) / 10 : 0,
    }
  })
  const practiced = rows.reduce((s, d) => s + d.attempted, 0)
  if (practiced <= 0) {
    return <ChartEmpty message="No one practiced in this window. Bands appear once weekly practice exists." />
  }

  const yMax = Math.max(4, ...rows.map((r) => r.attempted))
  const yTicks = Array.from({ length: yMax + 1 }, (_, i) => i)
  const fills = INSTITUTION_TRAJECTORY_FILLS
  const bands = [
    ["emerging", "Emerging", fills.emerging],
    ["developing", "Developing", fills.developing],
    ["proficient", "Proficient", fills.proficient],
    ["mastered", "Mastered", fills.mastered],
  ] as const

  return (
    <div className="space-y-3">
      <div className="flex h-[220px] min-w-0 gap-2">
        <div className="flex w-6 shrink-0 flex-col justify-between pb-6 pt-1 text-right">
          {[...yTicks].reverse().map((tick) => (
            <span key={tick} className={cn("text-[10px] tabular-nums leading-none", PORTAL_TEXT_MUTED)}>
              {tick}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-x-0 top-1 bottom-6 flex flex-col justify-between">
            {yTicks.map((tick) => (
              <div key={tick} className="border-t border-dashed border-[color-mix(in_srgb,var(--cc-text)_12%,transparent)]" />
            ))}
          </div>
          <div className="absolute inset-x-0 top-1 bottom-6 flex items-end gap-2 sm:gap-3">
            {rows.map((row) => {
              const segs = bands
                .map(([key, name, fill]) => ({ key, name, fill, value: Number(row[key] ?? 0) }))
                .filter((s) => s.value > 0)
              return (
                <div key={row.label} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                  <div
                    className="flex w-[42%] max-w-[36px] min-w-[18px] flex-col-reverse overflow-hidden rounded-t-md"
                    style={{ height: `${(row.attempted / yMax) * 100}%` }}
                    title={`${row.label}: ${row.attempted} of ${row.roster} practiced`}
                  >
                    {segs.map((seg, i) => (
                      <div
                        key={seg.key}
                        className={cn(i === segs.length - 1 && "rounded-t-md")}
                        style={{ height: `${(seg.value / row.attempted) * 100}%`, background: seg.fill }}
                      />
                    ))}
                  </div>
                  <div className="pointer-events-none absolute bottom-[calc(100%-0.25rem)] z-10 hidden min-w-[9rem] rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 shadow-lg group-hover:block">
                    <p className={cn("mb-1 text-xs font-medium", PORTAL_TEXT)}>{row.label}</p>
                    <p className={cn("mb-1.5 text-[11px]", PORTAL_TEXT_MUTED)}>
                      {row.attempted} of {row.roster} practiced ({row.attemptRate}%)
                    </p>
                    {bands.map(([key, name, fill]) => (
                      <p key={key} className="text-xs tabular-nums text-[var(--cc-text-secondary)]">
                        <span className="mr-1.5 inline-block size-1.5 rounded-full" style={{ background: fill }} />
                        {name}: {Number(row[key] ?? 0)}
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex h-6 items-end gap-2 sm:gap-3">
            {rows.map((row) => (
              <p key={row.label} className={cn("min-w-0 flex-1 truncate text-center text-[10px] leading-none", PORTAL_TEXT_MUTED)}>
                {row.label}
              </p>
            ))}
          </div>
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        {(
          [
            ["Emerging", fills.emerging],
            ["Developing", fills.developing],
            ["Proficient", fills.proficient],
            ["Mastered", fills.mastered],
          ] as const
        ).map(([name, fill]) => (
          <li key={name} className={cn("flex items-center gap-1.5", PORTAL_TEXT_MUTED)}>
            <span className="size-2 rounded-full" style={{ background: fill }} />
            {name}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <p className={cn("text-[10px] font-medium", PORTAL_TEXT)}>{row.label}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(row.attemptRate > 0 ? 8 : 0, row.attemptRate)}%`,
                  background: fills.attempt,
                }}
              />
            </div>
            <p className={cn("mt-1 text-[10px] tabular-nums", PORTAL_TEXT_MUTED)}>
              {row.attempted}/{row.roster} practiced
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function EngagementLineChart({ data, empty = "No engagement data for this period" }: { data: InstitutionWeekPoint[]; empty?: string }) {
  const has = data.some((d) => d.activeUsers > 0)
  if (!has) return <ChartEmpty message={empty} />
  return <ActiveUsersChart data={data} />
}

export function ProductivityBarChart({ data }: { data: InstitutionNamedCount[] }) {
  return <NamedBarChart data={data} empty="Productivity estimates appear after automated workflows run." valueLabel="Est. hours saved" />
}
