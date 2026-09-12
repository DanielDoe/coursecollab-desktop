"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  Clock,
  Flame,
  MessageSquare,
  Sparkles,
  Target,
  Users,
} from "lucide-react"
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"
import { DashboardKpiCard } from "@/components/dashboard-v2/DashboardKpiCard"
import { MetricTip } from "@/components/instructor/cora-insights/metric-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CATEGORY_LABELS, DEPENDENCE_COPY, HEALTH_LABELS, METRIC_DEFINITIONS } from "@/lib/cora/insights/taxonomy"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "needs", label: "Student Needs" },
  { id: "gaps", label: "Learning Gaps" },
  { id: "usage", label: "Cora Usage" },
  { id: "assistance", label: "AI Assistance" },
  { id: "live", label: "Live Activity" },
  { id: "predictions", label: "Predictions" },
  { id: "interventions", label: "Interventions" },
] as const

type TabId = (typeof TABS)[number]["id"]

/** Theme `chartPalette` — skip adjacent near-duplicates (accent / accentHover). */
const CHART_COLORS = [
  "var(--cc-chart-1, var(--cc-accent))",
  "var(--cc-chart-3, var(--cc-success))",
  "var(--cc-chart-4, var(--cc-warning))",
  "var(--cc-chart-5, var(--cc-danger))",
  "var(--cc-chart-2, var(--cc-accent-hover))",
]

async function fetchTab(tab: string, extra?: Record<string, string>) {
  const qs = new URLSearchParams({ tab, ...extra })
  const res = await instructorApiFetch(`/api/instructor/cora-insights?${qs}`)
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.ok) throw new Error(json.error || "Failed")
  return json.data
}

function EmptyState({ title, body }: { title: string; body: string }) {
  const chrome = facultyEmbedChrome("cora-insights")
  return (
    <div className={cn(chrome.card, "flex flex-col items-center gap-3 px-4 py-10 text-center")}>
      <div className={chrome.iconBadge("sm")}>
        <BarChart3 className="size-5" />
      </div>
      <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{title}</p>
      <p className={cn("max-w-md text-xs", PORTAL_TEXT_MUTED)}>{body}</p>
    </div>
  )
}

function hourLabel(hour: number) {
  if (hour === 0) return "12a"
  if (hour === 12) return "12p"
  if (hour < 12) return `${hour}a`
  return `${hour - 12}p`
}

const HEAT_BUCKETS = [
  { id: 0, label: "12–4a" },
  { id: 1, label: "4–8a" },
  { id: 2, label: "8a–12p" },
  { id: 3, label: "12–4p" },
  { id: 4, label: "4–8p" },
  { id: 5, label: "8p–12a" },
]

function HourHeatmap({
  heat,
  days,
}: {
  heat: Array<{ dow: number; hour: number; count: number }>
  days: string[]
}) {
  const buckets = days.map((_, dow) =>
    HEAT_BUCKETS.map((b) =>
      heat
        .filter((h) => h.dow === dow && Math.floor(h.hour / 4) === b.id)
        .reduce((s, h) => s + h.count, 0),
    ),
  )
  const maxH = Math.max(1, ...buckets.flat())
  const peak = { dow: 0, bucket: 0, count: 0 }
  buckets.forEach((row, dow) => {
    row.forEach((count, bucket) => {
      if (count > peak.count) Object.assign(peak, { dow, bucket, count })
    })
  })
  return (
    <div className="space-y-3">
      {peak.count > 0 ? (
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          Busiest: {days[peak.dow]} {HEAT_BUCKETS[peak.bucket].label} · {peak.count} sessions
        </p>
      ) : null}
      <div className="space-y-1.5">
        <div className="grid grid-cols-[52px_repeat(6,minmax(0,1fr))] gap-1.5">
          <div />
          {HEAT_BUCKETS.map((b) => (
            <div key={b.id} className={cn("text-center text-[10px] font-medium", PORTAL_TEXT_MUTED)}>
              {b.label}
            </div>
          ))}
        </div>
        {days.map((day, dow) => (
          <div key={day} className="grid grid-cols-[52px_repeat(6,minmax(0,1fr))] gap-1.5">
            <div className={cn("flex items-center text-xs font-medium", PORTAL_TEXT)}>{day}</div>
            {HEAT_BUCKETS.map((b, i) => {
              const v = buckets[dow]?.[i] ?? 0
              const intensity = Math.round((v / maxH) * 100)
              return (
                <div
                  key={b.id}
                  title={`${day} ${b.label} · ${v} sessions`}
                  className="flex h-8 items-center justify-center rounded-md bg-[var(--muted)] text-[10px] font-medium text-[var(--cc-text)]"
                  style={
                    v > 0
                      ? { background: `color-mix(in oklab, var(--cc-accent) ${Math.max(28, intensity)}%, transparent)` }
                      : undefined
                  }
                >
                  {v > 0 ? v : ""}
                </div>
              )
            })}
          </div>
        ))}
        <div className={cn("flex items-center justify-end gap-2 pt-1 text-[10px]", PORTAL_TEXT_MUTED)}>
          <span>Less</span>
          {[0, 25, 50, 75, 100].map((n) => (
            <span
              key={n}
              className="size-3 rounded-sm bg-[var(--muted)]"
              style={n ? { background: `color-mix(in oklab, var(--cc-accent) ${n}%, transparent)` } : undefined}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={cn("mb-1 block text-[11px] font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
        {label}
      </span>
      {children}
    </label>
  )
}

function riskBadgeClass(risk: string, chrome: ReturnType<typeof facultyEmbedChrome>) {
  if (risk === "high") return chrome.danger
  if (risk === "medium") return chrome.warning
  if (risk === "watch") return chrome.solid
  return chrome.quiet
}

function riskWellClass(risk: string) {
  if (risk === "high") return "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
  if (risk === "medium") return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
  if (risk === "watch") return "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
  return "bg-[var(--muted)] text-[var(--cc-text-secondary)]"
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?"
}

function SectionTitle({ children, tip }: { children: ReactNode; tip?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{children}</h3>
      {tip ? <MetricTip id={tip} /> : null}
    </div>
  )
}

export function CoraInsightsDashboard() {
  const chrome = facultyEmbedChrome("cora-insights")
  const [tab, setTab] = useState<TabId>("overview")
  const [range, setRange] = useState("7d")
  const [assessmentId, setAssessmentId] = useState("all")
  const [topic, setTopic] = useState("all")
  const [studentId, setStudentId] = useState("all")
  const [liveFilter, setLiveFilter] = useState("all")
  const [filters, setFilters] = useState<any>(null)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [profileId, setProfileId] = useState<number | null>(null)
  const [profileSeed, setProfileSeed] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  function openStudent(id: number, seed?: any) {
    setProfileId(id)
    setProfileSeed(seed ?? null)
    setProfile(null)
  }

  const extra = useMemo(() => {
    const o: Record<string, string> = { range }
    if (assessmentId !== "all") o.assessmentId = assessmentId
    if (topic !== "all") o.topic = topic
    if (studentId !== "all") o.studentId = studentId
    return o
  }, [range, assessmentId, topic, studentId, tab])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const [f, d] = await Promise.all([
          fetchTab("filters", extra),
          fetchTab(tab, extra),
        ])
        if (cancelled) return
        setFilters(f)
        setData(d)
      } catch (err) {
        console.error(err)
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, extra])

  useEffect(() => {
    if (!profileId) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    let cancelled = false
    setProfileLoading(true)
    void instructorApiFetch(`/api/instructor/cora-insights/student/${profileId}?range=${range}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setProfile(j.data)
      })
      .catch(() => {
        if (!cancelled) setProfile(null)
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profileId, range])

  return (
    <div className="w-full min-w-0 space-y-4 p-3 sm:p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className={cn("text-lg font-semibold", PORTAL_TEXT)}>Cora Insights</h1>
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            What is happening, why, who is affected, and what to do next.
          </p>
        </div>
        <Button asChild className={cn(chrome.cta, "h-9 shrink-0")} size="sm">
          <Link href="/faculty/dashboard/cora?prompt=Summarize%20Cora%20Insights%20for%20tomorrow%27s%20class">
            Ask Cora
          </Link>
        </Button>
      </div>

      <div className={cn(chrome.card, "p-3")}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <FilterField label="Date range">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="semester">Semester</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Assessment">
            <Select value={assessmentId} onValueChange={setAssessmentId}>
              <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Assessment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assessments</SelectItem>
                {(filters?.assessments ?? []).map((a: any) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Topic">
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Topic" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All topics</SelectItem>
                {(filters?.topics ?? []).map((t: string) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Student">
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Student" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All students</SelectItem>
                {(filters?.students ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="flex w-max min-w-full gap-1.5 px-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "h-9 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium",
                tab === t.id ? chrome.solid : chrome.quiet,
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : tab === "overview" ? (
        <OverviewTab data={data} onStudent={openStudent} onTab={setTab} />
      ) : tab === "needs" ? (
        <NeedsTab data={data} onStudent={openStudent} />
      ) : tab === "gaps" ? (
        <GapsTab data={data} extra={extra} onReload={setData} />
      ) : tab === "usage" ? (
        <UsageTab data={data} />
      ) : tab === "assistance" ? (
        <AssistanceTab data={data} />
      ) : tab === "live" ? (
        <LiveTab data={data} liveFilter={liveFilter} setLiveFilter={setLiveFilter} />
      ) : tab === "predictions" ? (
        <PredictionsTab data={data} onStudent={openStudent} />
      ) : (
        <InterventionsTab data={data} />
      )}

      <StudentProfileDrawer
        open={profileId != null}
        studentId={profileId}
        range={range}
        onClose={() => {
          setProfileId(null)
          setProfileSeed(null)
        }}
        loading={profileLoading}
        profile={profile}
        seed={profileSeed}
      />
    </div>
  )
}

function StudentProfileDrawer({
  open,
  studentId,
  range,
  onClose,
  loading,
  profile,
  seed,
}: {
  open: boolean
  studentId: number | null
  range: string
  onClose: () => void
  loading: boolean
  profile: any
  seed: any
}) {
  const chrome = facultyEmbedChrome("cora-insights")
  const { toast } = useToast()
  const [assigning, setAssigning] = useState(false)
  const student = profile?.student ?? seed
  const concepts = profile?.concepts ?? []
  const recent = profile?.recent ?? []
  const timeline = profile?.timeline ?? []
  const recordId = Number(student?.id ?? studentId)
  const recordHref = Number.isFinite(recordId) && recordId > 0
    ? `/faculty/dashboard/management/students/${recordId}`
    : "/faculty/dashboard/management/students"
  const risk = String(student?.risk ?? "low")

  async function assignPractice() {
    if (!studentId || assigning) return
    setAssigning(true)
    try {
      const res = await instructorApiFetch(
        `/api/instructor/cora-insights/student/${studentId}?action=assign-practice&range=${encodeURIComponent(range)}`,
        { method: "POST" },
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to assign practice")
      toast({
        title: "Targeted practice assigned",
        description: `${student?.name ?? "Student"} was messaged and notified. A copy is in their progress report.`,
      })
    } catch (err) {
      toast({
        title: "Could not assign practice",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setAssigning(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden border-l border-[var(--border)] bg-[var(--cc-modal-surface)] p-0 sm:max-w-md"
      >
        <SheetHeader className="space-y-1 border-b border-[var(--border)] px-5 pb-4 pt-5 text-left">
          <p className={cn("text-[11px] font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
            Cora Insights
          </p>
          <SheetTitle className={cn("text-lg font-semibold tracking-tight", PORTAL_TEXT)}>
            Student profile
          </SheetTitle>
          <SheetDescription className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            How this student is using Cora and where they may need support.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {student ? (
            <div className={cn(chrome.card, "overflow-hidden")}>
              <div className={cn("flex items-center gap-3 px-4 py-3.5", chrome.p.softBg)}>
                <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold", riskWellClass(risk))}>
                  {initials(String(student.name ?? ""))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate font-semibold", PORTAL_TEXT)}>{student.name}</p>
                  <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)}>
                    {[student.code, student.section].filter(Boolean).join(" · ") || "Enrolled student"}
                  </p>
                </div>
                <Badge className={riskBadgeClass(risk, chrome)}>{risk.toUpperCase()}</Badge>
              </div>
              <div className="space-y-3 px-4 py-3.5">
                <p className={cn("text-sm", PORTAL_TEXT)}>{student.primaryConcern}</p>
                {student.evidence ? (
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{student.evidence}</p>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-[var(--border)] px-3 py-2">
                    <p className={cn("text-[11px] uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Cora sessions</p>
                    <p className={cn("text-base font-semibold", PORTAL_TEXT)}>{student.coraSessions ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] px-3 py-2">
                    <p className={cn("text-[11px] uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Usage</p>
                    <p className={cn("text-base font-semibold", PORTAL_TEXT)}>{student.coraUsage ?? "—"}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] px-3 py-2">
                    <p className={cn("text-[11px] uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Performance</p>
                    <p className={cn("text-base font-semibold", PORTAL_TEXT)}>
                      {student.performance != null ? `${student.performance}%` : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] px-3 py-2">
                    <p className={cn("text-[11px] uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Last activity</p>
                    <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>
                      {student.lastActivity ? new Date(student.lastActivity).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="space-y-2">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          ) : (
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Not enough data yet for this student.</p>
          )}

          <div>
            <SectionTitle>Cora topics</SectionTitle>
            {loading && !concepts.length ? (
              <Skeleton className="h-24 rounded-xl" />
            ) : concepts.length ? (
              <div className={cn(chrome.card, "divide-y divide-[var(--border)]")}>
                {concepts.map((c: any, i: number) => {
                  const stripe = portalListStripe(i, chrome.theme.family)
                  return (
                    <div key={`${c.concept}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                      <div className={cn("flex size-8 items-center justify-center rounded-lg", stripe.iconBg, stripe.iconText)}>
                        <Brain className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm font-medium", PORTAL_TEXT)}>{c.concept}</p>
                        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                          {c.requests} request{c.requests === 1 ? "" : "s"}
                          {c.successAfter != null ? ` · ${c.successAfter}% after help` : ""}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className={cn("rounded-xl border border-[var(--border)] px-3 py-6 text-center text-sm", PORTAL_TEXT_MUTED)}>
                No topic breakdown in this range yet.
              </p>
            )}
          </div>

          <div>
            <SectionTitle>Recent Cora activity</SectionTitle>
            {loading && !recent.length && !timeline.length ? (
              <Skeleton className="h-24 rounded-xl" />
            ) : recent.length ? (
              <div className={cn(chrome.card, "divide-y divide-[var(--border)]")}>
                {recent.slice(0, 8).map((item: any, i: number) => (
                  <div key={`${item.at}-${i}`} className="flex items-start gap-3 px-3 py-2.5">
                    <div className={cn("mt-0.5 flex size-8 items-center justify-center rounded-lg", chrome.p.softBg, chrome.p.iconText)}>
                      <Clock className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={cn("text-sm", PORTAL_TEXT)}>{item.summary}</p>
                      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                        {item.at ? new Date(item.at).toLocaleString() : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : timeline.length ? (
              <ol className={cn(chrome.card, "divide-y divide-[var(--border)]")}>
                {timeline.map((w: any) => (
                  <li key={w.week} className="px-3 py-2.5 text-sm">
                    <p className={PORTAL_TEXT}>{w.label}</p>
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                      Week of {w.week} · {w.requests} requests
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={cn("rounded-xl border border-[var(--border)] px-3 py-6 text-center text-sm", PORTAL_TEXT_MUTED)}>
                No recent Cora activity in this range.
              </p>
            )}
          </div>
        </div>

        <SheetFooter className="mt-0 gap-2 border-t border-[var(--border)] px-5 py-4 sm:flex-col">
          <Button size="sm" className={chrome.cta} disabled={!studentId || assigning} onClick={() => void assignPractice()}>
            {assigning ? "Assigning…" : "Assign targeted practice"}
          </Button>
          <Button asChild size="sm" className={chrome.quiet}>
            <Link href={recordHref}>Open student record</Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function OverviewTab({ data, onStudent, onTab }: { data: any; onStudent: (id: number, seed?: any) => void; onTab: (t: TabId) => void }) {
  const chrome = facultyEmbedChrome("cora-insights")
  if (!data) return <EmptyState title="Not enough data yet" body="Cora Insights will fill in as students use Cora in this course." />
  const kpis = data.kpis ?? []
  const icons = [MessageSquare, Users, AlertTriangle, Activity, Target, Sparkles]
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k: any, i: number) => (
          <button key={k.id} type="button" className="text-left" onClick={() => {
            if (k.id === "students_needing_attention") onTab("needs")
            if (k.id === "cora_sessions") onTab("usage")
            if (k.id === "assisted_success") onTab("assistance")
          }}>
            <DashboardKpiCard
              facultyModuleId="cora-insights"
              label={METRIC_DEFINITIONS[k.id]?.label ?? k.id}
              value={k.value == null ? "—" : k.value}
              sub={k.delta != null ? `${k.delta > 0 ? "↑" : "↓"} ${Math.abs(k.delta)}% · ${k.sub}` : k.sub}
              icon={icons[i] ?? Activity}
              valueKind={k.id === "assisted_success" ? "percent" : "auto"}
            />
          </button>
        ))}
      </div>

      <div className={cn(chrome.card, "p-4")}>
        <SectionTitle tip="cora_sessions">Cora Class Summary</SectionTitle>
        <p className={cn("text-sm leading-relaxed", PORTAL_TEXT)}>{data.summary}</p>
      </div>

      <div className={cn(chrome.card, "p-4")}>
        <SectionTitle tip="learning_health">Class Learning Health</SectionTitle>
        {data.health?.sample >= 5 ? (
          <div className="space-y-2">
            <div className="flex h-4 overflow-hidden rounded-full">
              {data.health.bands.map((b: any) => (
                b.pct > 0 ? (
                  <button
                    key={b.band}
                    type="button"
                    title={`${HEALTH_LABELS[b.band as keyof typeof HEALTH_LABELS]} ${b.pct}%`}
                    onClick={() => onTab("needs")}
                    className={cn(
                      "h-full",
                      b.band === "strong" && "bg-emerald-600",
                      b.band === "developing" && "bg-amber-500",
                      b.band === "struggling" && "bg-orange-600",
                      b.band === "critical" && "bg-rose-700",
                    )}
                    style={{ width: `${b.pct}%` }}
                  />
                ) : null
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {data.health.bands.map((b: any) => (
                <p key={b.band} className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                  {HEALTH_LABELS[b.band as keyof typeof HEALTH_LABELS]} {b.pct}%
                </p>
              ))}
            </div>
          </div>
        ) : (
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Not enough scored items yet (need 5+ students with 3+ items).</p>
        )}
      </div>

      <div>
        <SectionTitle tip="students_needing_attention">Students needing attention</SectionTitle>
        <NeedsTable rows={data.attentionPreview ?? []} onStudent={onStudent} compact />
      </div>

      <div>
        <SectionTitle>Recommended instructor actions</SectionTitle>
        <ActionList items={data.recommendedActions ?? []} />
      </div>
    </div>
  )
}

function NeedsTable({ rows, onStudent, compact }: { rows: any[]; onStudent: (id: number, seed?: any) => void; compact?: boolean }) {
  const chrome = facultyEmbedChrome("cora-insights")
  if (!rows.length) return <EmptyState title="No attention flags" body="No student currently meets the multi-signal attention threshold." />
  return (
    <div className={cn(chrome.card, "overflow-x-auto")}>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          <tr className="border-b border-[var(--border)]">
            {["Student", "Risk", "Primary concern", "Evidence", "Trend", "Cora", "Last activity", ""].map((h) => (
              <th key={h} className="px-3 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-muted/40">
              <td className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold", riskWellClass(String(s.risk)))}>
                    {initials(String(s.name ?? ""))}
                  </div>
                  <span className={cn("font-medium", PORTAL_TEXT)}>{s.name}</span>
                </div>
              </td>
              <td className="px-3 py-2">
                <Badge className={riskBadgeClass(String(s.risk), chrome)}>
                  {String(s.risk).toUpperCase()}
                </Badge>
              </td>
              <td className={cn("max-w-[180px] px-3 py-2 text-xs", PORTAL_TEXT_MUTED)}>{s.primaryConcern}</td>
              <td className={cn("max-w-[220px] px-3 py-2 text-xs", PORTAL_TEXT_MUTED)}>{compact ? String(s.evidence).slice(0, 80) : s.evidence}</td>
              <td className={cn("px-3 py-2 capitalize", PORTAL_TEXT)}>{s.trend}</td>
              <td className={cn("px-3 py-2", PORTAL_TEXT)}>{s.coraUsage}</td>
              <td className={cn("px-3 py-2 text-xs", PORTAL_TEXT_MUTED)}>
                {s.lastActivity ? new Date(s.lastActivity).toLocaleString() : "—"}
              </td>
              <td className="px-3 py-2">
                <Button size="sm" className={chrome.cta} onClick={() => onStudent(s.id, s)}>View Student</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function needsBarFill(risk: string) {
  if (risk === "high") return "#be123c"
  if (risk === "medium") return "#b45309"
  if (risk === "watch") return "var(--cc-accent)"
  return "#0f766e"
}

function NeedsTab({ data, onStudent }: { data: any; onStudent: (id: number, seed?: any) => void }) {
  const chrome = facultyEmbedChrome("cora-insights")
  const bars = [...(data?.students ?? [])]
    .filter((s: any) => Number(s.coraSessions) > 0)
    .sort((a: any, b: any) => Number(b.coraSessions) - Number(a.coraSessions))
    .slice(0, 12)
  return (
    <div className="space-y-5">
      <NeedsTable rows={data?.students ?? []} onStudent={onStudent} />
      <div className={cn(chrome.card, "p-4")}>
        <SectionTitle tip="students_needing_attention">Cora sessions by student</SectionTitle>
        <p className={cn("mb-3 text-xs", PORTAL_TEXT_MUTED)}>
          Who is using Cora the most in this window. Click a bar to open the student.
        </p>
        {bars.length ? (
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={bars} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  content={({ payload }) => {
                    const p = payload?.[0]?.payload
                    if (!p) return null
                    return (
                      <div className={cn(chrome.card, "p-2 text-xs")}>
                        <p className="font-medium">{p.name}</p>
                        <p>{p.coraSessions} Cora sessions · {String(p.risk).toUpperCase()}</p>
                        <p>{p.primaryConcern || p.topDifficulty}</p>
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="coraSessions"
                  name="Cora sessions"
                  radius={[0, 6, 6, 0]}
                  onClick={(d: any) => d?.id && onStudent(d.id, d)}
                >
                  {bars.map((s: any) => (
                    <Cell key={s.id} fill={needsBarFill(String(s.risk))} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className={cn("py-10 text-center text-sm", PORTAL_TEXT_MUTED)}>
            No Cora sessions to rank in this range.
          </p>
        )}
      </div>
    </div>
  )
}

function GapsTab({ data, extra, onReload }: { data: any; extra: Record<string, string>; onReload: (d: any) => void }) {
  const chrome = facultyEmbedChrome("cora-insights")
  const concepts = data?.concepts ?? []
  const max = Math.max(1, ...concepts.map((c: any) => c.students))
  const [mistake, setMistake] = useState<any | null>(null)
  return (
    <div className="space-y-5">
      <div className={cn(chrome.card, "p-4")}>
        <SectionTitle tip="concept_difficulty">Concept difficulty map</SectionTitle>
        {concepts.length ? (
          <div className="space-y-2">
            {concepts.map((c: any) => (
              <button
                key={c.concept}
                type="button"
                className="grid w-full grid-cols-[10rem_1fr_auto] items-center gap-2 text-left"
                onClick={async () => {
                  const next = await fetchTab("gaps", { ...extra, concept: c.concept })
                  onReload(next)
                }}
              >
                <span className={cn("truncate text-sm", PORTAL_TEXT)}>{c.concept}</span>
                <div className="h-3 overflow-hidden rounded bg-muted">
                  <div className="h-full bg-[var(--cc-accent)]" style={{ width: `${(c.students / max) * 100}%` }} />
                </div>
                <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>{c.students} students</span>
              </button>
            ))}
          </div>
        ) : (
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Not enough data yet.</p>
        )}
      </div>

      {data?.conceptDetail && !data.conceptDetail.empty ? (
        <div className={cn(chrome.card, "p-4")}>
          <SectionTitle>What students are struggling with — {data.conceptDetail.concept}</SectionTitle>
          <p className={cn("mb-3 text-xs", PORTAL_TEXT_MUTED)}>
            {data.conceptDetail.students} students · {data.conceptDetail.sessions} sessions
            {data.conceptDetail.successAfter != null ? ` · ${data.conceptDetail.successAfter}% after Cora` : ""}
            {data.conceptDetail.independentSuccess != null ? ` · ${data.conceptDetail.independentSuccess}% independent later` : ""}
          </p>
          <div className="divide-y divide-[var(--border)]">
            {(data.conceptDetail.struggles ?? []).map((s: any, i: number) => {
              const stripe = portalListStripe(i, chrome.theme.family)
              return (
                <div key={s.label} className="flex items-center gap-3 py-2">
                  <div className={cn("flex size-8 items-center justify-center rounded-lg", stripe.iconBg, stripe.iconText)}>
                    <Target className="size-4" />
                  </div>
                  <p className={cn("flex-1 text-sm", PORTAL_TEXT)}>{s.label}</p>
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{s.students} students</p>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className={cn(chrome.card, "p-4")}>
        <SectionTitle>Topic heatmap</SectionTitle>
        {data?.heatmap?.rows?.length ? (
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left">Concept</th>
                  {(data.heatmap.weeks as string[]).map((w) => (
                    <th key={w} className="px-1 py-1">{w.slice(5)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.heatmap.rows.map((row: any) => (
                  <tr key={row.concept}>
                    <td className={cn("px-2 py-1", PORTAL_TEXT)}>{row.concept}</td>
                    {row.cells.map((cell: any) => (
                      <td key={cell.week} title={`${cell.week} · ${cell.students} students · ${cell.requests} requests`} className="px-1 py-1">
                        <div
                          className="size-5 rounded-sm"
                          style={{ background: `color-mix(in oklab, var(--cc-accent) ${Math.round(cell.intensity * 100)}%, transparent)` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Not enough weekly concept data yet.</p>
        )}
      </div>

      <div className={cn(chrome.card, "p-4")}>
        <SectionTitle>Common mistakes</SectionTitle>
        <p className={cn("mb-2 text-xs", PORTAL_TEXT_MUTED)}>
          Scanned from actual CodeBench submissions in this range. Click a row for the student lines.
        </p>
        {(data?.mistakes ?? []).length ? (
          <div className="divide-y divide-[var(--border)]">
            {data.mistakes.map((m: any) => (
              <button
                key={m.id ?? m.label}
                type="button"
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-muted/40"
                onClick={() => setMistake(m)}
              >
                <span className={cn("text-sm", PORTAL_TEXT)}>{m.label}</span>
                <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>{m.students} students · {m.occurrences}×</span>
              </button>
            ))}
          </div>
        ) : (
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No missing semicolons or cin/cout operator mixups in this range.</p>
        )}
      </div>

      <Dialog open={Boolean(mistake)} onOpenChange={(open) => !open && setMistake(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{mistake?.label}</DialogTitle>
            <DialogDescription>
              {mistake?.detail}
              {" "}
              {mistake ? `${mistake.students} students · ${mistake.occurrences} submissions.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[360px] space-y-3 overflow-y-auto">
            {(mistake?.examples ?? []).map((ex: any, i: number) => (
              <div key={`${ex.submissionId}-${ex.line}-${i}`} className={cn(chrome.card, "p-3")}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Link
                    href={`/faculty/dashboard/management/students/${ex.studentId}`}
                    className={cn("text-sm font-medium underline-offset-2 hover:underline", PORTAL_TEXT)}
                  >
                    {ex.studentName}
                  </Link>
                  <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>Line {ex.line}</span>
                </div>
                <pre className="overflow-x-auto rounded-md bg-muted/60 px-3 py-2 font-mono text-xs text-[var(--cc-text)]">
                  {ex.snippet}
                </pre>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UsageTab({ data }: { data: any }) {
  const chrome = facultyEmbedChrome("cora-insights")
  const slices = data?.categories?.slices ?? []
  const timeline = data?.timeline ?? []
  const heat = data?.hourHeat ?? []
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const stackKeys = [
    { key: "debugging", name: "Debugging", fill: CHART_COLORS[0] },
    { key: "analysis", name: "Analysis", fill: CHART_COLORS[1] },
    { key: "planning", name: "Planning", fill: CHART_COLORS[2] },
    { key: "other", name: "Other", fill: CHART_COLORS[3] },
  ].filter((s) => timeline.some((d: any) => (d[s.key] ?? 0) > 0))
  const showStacks = stackKeys.length > 0
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(chrome.card, "p-4")}>
          <SectionTitle>How students use Cora</SectionTitle>
          {slices.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={slices} dataKey="count" nameKey="label" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
                      {slices.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [`${value} sessions`, name]} />
                    <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-[var(--cc-text)] text-2xl font-semibold">
                      {data.categories.total}
                    </text>
                    <text x="50%" y="60%" textAnchor="middle" className="fill-[var(--cc-text-secondary)] text-[11px]">
                      sessions
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col justify-center space-y-2.5">
                {slices.map((s: any, i: number) => (
                  <div key={s.category} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className={cn("leading-snug", PORTAL_TEXT)}>{s.label}</span>
                    </span>
                    <span className={cn("shrink-0 tabular-nums", PORTAL_TEXT_MUTED)}>{s.count} · {s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className={cn("py-10 text-center text-sm", PORTAL_TEXT_MUTED)}>
              No Cora sessions in this range yet.
            </p>
          )}
        </div>
        <div className={cn(chrome.card, "p-4")}>
          <SectionTitle>Usage over time</SectionTitle>
          {timeline.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <ComposedChart data={timeline} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "var(--cc-text-muted)" }} interval={0} />
                  <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--cc-text-muted)" }} width={28} />
                  <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--cc-text-muted)" }} width={22} />
                  <CartesianGrid
                    yAxisId="left"
                    strokeDasharray="4 4"
                    stroke="var(--cc-text-secondary)"
                    strokeOpacity={0.35}
                    vertical={false}
                    horizontal
                  />
                  {timeline.map((d: any) => (
                    <ReferenceLine
                      key={d.date}
                      x={d.dateLabel}
                      yAxisId="left"
                      stroke="var(--cc-text-secondary)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.4}
                    />
                  ))}
                  <Tooltip />
                  <Legend
                    itemSorter={(item) =>
                      ["Debugging", "Analysis", "Planning", "Other", "Sessions", "Students"].indexOf(String(item.value))
                    }
                  />
                  {showStacks ? (
                    stackKeys.map((s, i) => (
                      <Bar
                        key={s.key}
                        yAxisId="left"
                        dataKey={s.key}
                        name={s.name}
                        stackId="s"
                        fill={s.fill}
                        radius={i === stackKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))
                  ) : (
                    <Bar yAxisId="left" dataKey="interactions" name="Sessions" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                  )}
                  <Line yAxisId="right" dataKey="students" name="Students" stroke={CHART_COLORS[4]} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS[4] }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className={cn("py-10 text-center text-sm", PORTAL_TEXT_MUTED)}>
              Usage will plot here once students start asking Cora.
            </p>
          )}
          {(data?.events ?? []).length ? (
            <p className={cn("mt-2 text-xs", PORTAL_TEXT_MUTED)}>
              Course events: {data.events.map((e: any) => e.title).join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
      <div className={cn(chrome.card, "p-4")}>
        <SectionTitle>Cora activity by time</SectionTitle>
        <p className={cn("mb-3 text-xs", PORTAL_TEXT_MUTED)}>Central time — when students actually opened Cora.</p>
        {heat.some((h: any) => h.count > 0) ? (
          <HourHeatmap heat={heat} days={days} />
        ) : (
          <p className={cn("py-10 text-center text-sm", PORTAL_TEXT_MUTED)}>
            No hourly activity in this range.
          </p>
        )}
      </div>
    </div>
  )
}

function AssistanceTab({ data }: { data: any }) {
  const chrome = facultyEmbedChrome("cora-insights")
  const funnel = data?.funnel
  const outcomes = data?.outcomes ?? []
  const usageMode = outcomes.some((o: any) => o.usageFallback) || Boolean(funnel?.usageFallback)
  const outcomeRows = outcomes.filter((o: any) => (o.sessions ?? 0) + (o.correct ?? 0) + (o.incorrect ?? 0) > 0)
  const compareRows = (data?.compare ?? []).filter((c: any) =>
    usageMode ? (c.sessions ?? c.coraAssisted ?? 0) > 0 : c.coraAssisted != null || c.independent != null,
  )
  const weeks = data?.dependence?.weeks ?? []
  const maxWeekN = Math.max(1, ...weeks.map((w: any) => w.n ?? 0))
  return (
    <div className="space-y-5">
      <div className={cn(chrome.card, "p-4")}>
        <SectionTitle tip="assisted_success">
          {usageMode ? "Cora help by tool" : "Student outcomes by assistance level"}
        </SectionTitle>
        {usageMode ? (
          <p className={cn("mb-2 text-xs", PORTAL_TEXT_MUTED)}>
            Session counts from CodeBench and Cora tools in this range. Graded correct/incorrect follow-up is not recorded yet.
          </p>
        ) : null}
        {outcomeRows.length ? (
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={outcomeRows} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="bucket" width={120} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {usageMode ? (
                  <>
                    <Bar dataKey="sessions" fill={CHART_COLORS[0]} name="Sessions" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="students" fill={CHART_COLORS[1]} name="Students" radius={[0, 4, 4, 0]} />
                  </>
                ) : (
                  <>
                    <Bar dataKey="incorrect" stackId="a" fill="#be123c" name="Incorrect" />
                    <Bar dataKey="correct" stackId="a" fill="#0f766e" name="Correct" />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No Cora assistance sessions in this range.</p>
        )}
      </div>
      <div className={cn(chrome.card, "p-4")}>
        <SectionTitle>Assistance → outcome funnel</SectionTitle>
        {funnel?.asked ? (
          <ol className="space-y-2 text-sm">
            <li>Asked Cora — {funnel.asked}</li>
            <li>{usageMode ? "Debugging & error help" : "Received guidance"} — {funnel.guided}</li>
            <li>{usageMode ? "Analysis & planning sessions" : "Retried question"} — {funnel.retried}</li>
            <li>{usageMode ? "CodeBench submissions" : "Solved question"} — {funnel.solved}</li>
            {funnel.independent ? <li>Solved related independently — {funnel.independent}</li> : null}
          </ol>
        ) : (
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No Cora sessions in this range.</p>
        )}
      </div>
      {usageMode ? null : (
        <div className={cn(chrome.card, "p-4")}>
          <SectionTitle>Cora-assisted vs independent</SectionTitle>
          <p className={cn("mb-2 text-xs", PORTAL_TEXT_MUTED)}>Observational comparison — not a causal claim.</p>
          {compareRows.length ? (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={compareRows} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="concept" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="coraAssisted" name="Cora-Assisted" fill={CHART_COLORS[0]} />
                  <Bar dataKey="independent" name="Independent" fill={CHART_COLORS[1]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No topic-level Cora sessions in this range.</p>
          )}
        </div>
      )}
      <div className={cn(chrome.card, "p-4")}>
        <SectionTitle tip="independence">{usageMode ? "Weekly Cora activity" : "Assistance need trend"}</SectionTitle>
        <p className={cn("text-sm", PORTAL_TEXT)}>{DEPENDENCE_COPY[data?.dependence?.label as keyof typeof DEPENDENCE_COPY] ?? "Insufficient Evidence"}</p>
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{data?.dependence?.note}</p>
        {weeks.length ? (
          <div className="mt-3 space-y-2">
            {weeks.map((w: any) => (
              <div key={w.week} className="flex items-center gap-2">
                <span className={cn("w-24 shrink-0 text-xs", PORTAL_TEXT_MUTED)}>{w.week}</span>
                <div className="h-2.5 flex-1 rounded bg-muted">
                  <div
                    className="h-full rounded bg-[var(--cc-accent)]"
                    style={{ width: `${Math.min(100, usageMode ? ((w.n ?? 0) / maxWeekN) * 100 : (w.depth / 5) * 100)}%` }}
                  />
                </div>
                <span className={cn("w-10 text-right text-xs", PORTAL_TEXT)}>{usageMode ? w.n : w.depth}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className={cn("mt-2 text-sm", PORTAL_TEXT_MUTED)}>No weekly Cora activity in this range.</p>
        )}
      </div>
      <div className={cn(chrome.card, "p-4")}>
        <SectionTitle tip="answers_blocked">Assessment integrity</SectionTitle>
        {(data?.integrity ?? []).length ? (
          <div className="divide-y divide-[var(--border)]">
            {data.integrity.map((i: any) => (
              <div key={`${i.assessmentId}-${i.type}`} className="py-2 text-sm">
                <p className={PORTAL_TEXT}>{i.type} {i.assessmentId ? `#${i.assessmentId}` : ""}</p>
                <p className={PORTAL_TEXT_MUTED}>
                  {i.requests} requests · {i.hints} hints · {i.concepts} explanations · {i.seeking} answer-seeking · {i.blocked} protected
                  {i.solvedPct != null ? ` · ${i.solvedPct}% subsequently solved` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No Ask Cora assessment events in this window.</p>
        )}
      </div>
    </div>
  )
}

const LIVE_FILTERS = [
  { id: "all", label: "All" },
  { id: "cora", label: "Cora" },
  { id: "assessment", label: "Assessment" },
  { id: "practice", label: "Practice" },
  { id: "codebench", label: "CodeBench" },
  { id: "learning", label: "Learning" },
] as const

function liveKindIcon(kind: string) {
  if (kind === "assessment") return Target
  if (kind === "practice") return Sparkles
  if (kind === "codebench") return Brain
  if (kind === "learning") return Clock
  return MessageSquare
}

function liveKindLabel(kind: string) {
  return LIVE_FILTERS.find((f) => f.id === kind)?.label ?? "Cora"
}

function LiveTab({ data, liveFilter, setLiveFilter }: { data: any; liveFilter: string; setLiveFilter: (v: string) => void }) {
  const chrome = facultyEmbedChrome("cora-insights")
  const events = (data?.events ?? []).filter((e: any) => liveFilter === "all" || e.kind === liveFilter)
  const topics = data?.hotTopics ?? []
  const spikes = data?.spikes ?? []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {LIVE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setLiveFilter(f.id)}
            className={cn(
              "inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium",
              liveFilter === f.id ? chrome.solid : chrome.quiet,
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <section className={cn(chrome.card, "flex min-h-[28rem] flex-col overflow-hidden")}>
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
            <div>
              <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Live feed</h3>
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Last 24 hours · {events.length} {events.length === 1 ? "event" : "events"}</p>
            </div>
            <div className={chrome.iconBadge("sm")}>
              <Activity className="size-4" />
            </div>
          </div>
          {events.length ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="divide-y divide-[var(--border)]">
                {events.map((e: any, i: number) => {
                  const stripe = portalListStripe(i, chrome.theme.family)
                  const Icon = liveKindIcon(e.kind)
                  return (
                    <div key={`${e.at}-${i}`} className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/40">
                      <div className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg", stripe.iconBg, stripe.iconText)}>
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {e.studentId ? (
                          <Link
                            href={`/faculty/dashboard/management/students/${e.studentId}`}
                            className={cn("text-sm font-medium hover:underline", PORTAL_TEXT)}
                          >
                            {e.student}
                          </Link>
                        ) : (
                          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{e.student}</p>
                        )}
                        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{e.concept || e.summary}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn("text-[11px] tabular-nums", PORTAL_TEXT_MUTED)}>
                          {new Date(e.at).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" })}
                        </p>
                        <p className={cn("text-[10px] font-medium", PORTAL_TEXT_MUTED)}>{liveKindLabel(e.kind)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <div className={cn("flex size-10 items-center justify-center rounded-xl", chrome.p.softBg, chrome.p.iconText)}>
                <Activity className="size-5" />
              </div>
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No matching activity</p>
              <p className={cn("max-w-xs text-xs", PORTAL_TEXT_MUTED)}>
                Nothing in the last 24 hours for this filter.
              </p>
            </div>
          )}
        </section>
        <section className={cn(chrome.card, "flex min-h-[28rem] flex-col overflow-hidden")}>
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
            <div>
              <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Hot topics</h3>
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Last 24 hours vs prior day</p>
            </div>
            <div className={cn("flex size-9 items-center justify-center rounded-lg", chrome.p.softBg, chrome.p.iconText)}>
              <Flame className="size-4" />
            </div>
          </div>
          {topics.length ? (
            <div className="divide-y divide-[var(--border)]">
              {topics.map((t: any, i: number) => {
                const stripe = portalListStripe(i, chrome.theme.family)
                return (
                  <div key={`${t.concept}-${i}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
                    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", stripe.iconBg, stripe.iconText)}>
                      <Flame className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", PORTAL_TEXT)}>{t.concept}</p>
                      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{t.requests} {t.requests === 1 ? "request" : "requests"}</p>
                    </div>
                    <span className={cn("shrink-0 text-xs font-medium tabular-nums", t.change > 0 ? chrome.p.iconText : PORTAL_TEXT_MUTED)}>
                      {t.change > 0 ? "+" : ""}{t.change}%
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="px-4 py-6">
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No velocity spike</p>
              <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>Topics appear when Cora use concentrates over the last day.</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-y border-[var(--border)] px-4 py-3">
            <div>
              <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Difficulty spikes</h3>
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>5+ students on one concept · last 45 min</p>
            </div>
            <div className={cn("flex size-9 items-center justify-center rounded-lg", chrome.p.softBg, chrome.p.iconText)}>
              <AlertTriangle className="size-4" />
            </div>
          </div>
          {spikes.length ? (
            <div className="min-h-0 flex-1 divide-y divide-[var(--border)] overflow-y-auto">
              {spikes.map((s: any, i: number) => {
                const stripe = portalListStripe(i, chrome.theme.family)
                return (
                  <div key={`${s.concept}-${i}`} className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/40">
                    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", stripe.iconBg, stripe.iconText)}>
                      <AlertTriangle className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{s.concept}</p>
                      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{s.message}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-center px-4 py-6">
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No cluster right now</p>
              <p className={cn("mt-1 max-w-sm text-xs", PORTAL_TEXT_MUTED)}>A spike appears when five or more students hit the same concept in 45 minutes.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function PredictionsTab({ data, onStudent }: { data: any; onStudent: (id: number, seed?: any) => void }) {
  const chrome = facultyEmbedChrome("cora-insights")
  return (
    <div className="space-y-3">
      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{data?.disclaimer}</p>
      {(data?.predictions ?? []).map((p: any) => (
        <div key={p.studentId} className={cn(chrome.card, "p-4")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={cn("font-medium", PORTAL_TEXT)}>{p.name}</p>
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                {p.prediction}: {String(p.level).toUpperCase()}
                {p.ready && p.confidence != null ? ` · Confidence ${p.confidence}%` : ""}
              </p>
            </div>
            <Button size="sm" className={chrome.cta} onClick={() => onStudent(p.studentId, { id: p.studentId, name: p.name })}>View Student</Button>
          </div>
          {p.ready ? (
            <ul className={cn("mt-2 list-disc pl-5 text-sm", PORTAL_TEXT)}>
              {p.evidence.map((e: string) => <li key={e}>{e}</li>)}
            </ul>
          ) : (
            <p className={cn("mt-2 text-sm", PORTAL_TEXT_MUTED)}>{p.note}</p>
          )}
          {p.ready ? <p className={cn("mt-2 text-sm", PORTAL_TEXT)}>Recommended: {p.action}</p> : null}
        </div>
      ))}
      {!(data?.predictions ?? []).length ? <EmptyState title="No validated predictions" body="Predictions appear only when multiple measurable features are present. We will not invent a forecast." /> : null}
    </div>
  )
}

function InterventionsTab({ data }: { data: any }) {
  return (
    <div>
      <SectionTitle>Recommended instructor actions</SectionTitle>
      <ActionList items={Array.isArray(data) ? data : data?.actions ?? data ?? []} />
    </div>
  )
}

function ActionList({ items }: { items: any[] }) {
  const chrome = facultyEmbedChrome("cora-insights")
  if (!items?.length) return <EmptyState title="No actions yet" body="Recommendations appear when concepts or students cross evidence thresholds." />
  return (
    <div className={cn(chrome.card, "divide-y divide-[var(--border)]")}>
      {items.map((a: any, i: number) => {
        const stripe = portalListStripe(i, chrome.theme.family)
        return (
          <div key={a.id ?? i} className="flex flex-wrap items-center gap-3 px-3 py-3">
            <div className={cn("flex size-9 items-center justify-center rounded-lg", stripe.iconBg, stripe.iconText)}>
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{a.title}</p>
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{a.detail}</p>
            </div>
            <Button asChild size="sm" className={chrome.cta}>
              <Link href={a.href}>{a.cta}</Link>
            </Button>
          </div>
        )
      })}
    </div>
  )
}
