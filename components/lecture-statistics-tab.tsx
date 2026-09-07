"use client"

import { useEffect, useState, type ReactNode } from "react"
import { CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import {
  BookOpen,
  Eye,
  MessageSquare,
  TrendingUp,
  Users,
  Star,
  Activity,
  Calendar,
  BarChart3,
  Loader2,
  Award,
  type LucideIcon,
} from "lucide-react"
import { getSessionStatGradient, getSectionColumnHeading } from "@/lib/instructor-section-presets"
import { useSessionCatalog } from "@/components/session-catalog-provider"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { Button } from "@/components/ui/button"

interface LectureStats {
  total_lectures: number
  total_slides: number
  total_comments: number
  total_views: number
  avg_engagement: number
  weekly_activity: {
    week: number
    lectures: number
    views: number
    comments: number
  }[]
  session_stats: {
    session: string | null
    lectures: number
    slides: number
    comments: number
    views: number
  }[]
  engagement_trends: {
    week_start: string
    comments: number
    avg_rating: number
  }[]
  top_lectures: {
    id: number
    title: string
    week: number
    session: string | null
    views: number
    comments: number
    avg_rating: number
  }[]
}

const COLORS = {
  primary: ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899'],
}

function normalizeLectureStats(raw: Partial<LectureStats> | null | undefined): LectureStats {
  return {
    total_lectures: Number(raw?.total_lectures) || 0,
    total_slides: Number(raw?.total_slides) || 0,
    total_comments: Number(raw?.total_comments) || 0,
    total_views: Number(raw?.total_views) || 0,
    avg_engagement: Number(raw?.avg_engagement) || 0,
    weekly_activity: Array.isArray(raw?.weekly_activity) ? raw.weekly_activity : [],
    session_stats: Array.isArray(raw?.session_stats) ? raw.session_stats : [],
    engagement_trends: Array.isArray(raw?.engagement_trends) ? raw.engagement_trends : [],
    top_lectures: Array.isArray(raw?.top_lectures) ? raw.top_lectures : [],
  }
}

const PANEL =
  "rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] overflow-hidden"
const PANEL_HEADER =
  "px-4 py-3 border-b border-slate-200/60 dark:border-white/[0.08]"

function StatKpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string
  value: string | number
  sub: string
  icon: LucideIcon
  tone: "blue" | "amber" | "violet" | "emerald"
}) {
  const toneClass = {
    blue: {
      card: "from-blue-50/80 to-white dark:from-blue-950/20 dark:to-white/[0.02]",
      icon: "bg-blue-500/15 dark:bg-blue-500/25 text-blue-600 dark:text-blue-400",
    },
    amber: {
      card: "from-amber-50/80 to-white dark:from-amber-950/20 dark:to-white/[0.02]",
      icon: "bg-amber-500/15 dark:bg-amber-500/25 text-amber-600 dark:text-amber-400",
    },
    violet: {
      card: "from-violet-50/80 to-white dark:from-violet-950/20 dark:to-white/[0.02]",
      icon: "bg-violet-500/15 dark:bg-violet-500/25 text-violet-600 dark:text-violet-400",
    },
    emerald: {
      card: "from-emerald-50/80 to-white dark:from-emerald-950/20 dark:to-white/[0.02]",
      icon: "bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400",
    },
  }[tone]

  return (
    <div
      className={`rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-gradient-to-br ${toneClass.card} p-4`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{sub}</p>
        </div>
        <div
          className={`flex size-9 items-center justify-center rounded-lg shrink-0 ${toneClass.icon}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

function ChartPanel({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description?: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <div className={PANEL}>
      <div className={PANEL_HEADER}>
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{title}</h4>
            {description ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

export function LectureStatisticsTab({
  initialStats,
  lectureCountFallback = 0,
}: {
  initialStats?: LectureStats | null
  lectureCountFallback?: number
} = {}) {
  const { labelByCode } = useSessionCatalog()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [stats, setStats] = useState<LectureStats | null>(initialStats ?? null)
  const [loading, setLoading] = useState(!initialStats)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (initialStats) {
      setStats(normalizeLectureStats(initialStats))
      setLoading(false)
      setFetchError(null)
    }
  }, [initialStats])

  useEffect(() => {
    void fetchStats()
  }, [courseScopeVersion])

  const fetchStats = async () => {
    try {
      setLoading(true)
      setFetchError(null)
      const response = await instructorApiFetch("/api/instructor/lecture-stats", {
        headers: buildInstructorAuthorizedApiHeaders(),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.stats) {
          setStats(normalizeLectureStats(data.stats))
          setFetchError(null)
        } else {
          setStats(null)
          setFetchError("Analytics response was empty. Try again in a moment.")
        }
      } else {
        const body = await response.json().catch(() => ({}))
        const message =
          typeof body.error === "string"
            ? body.error
            : response.status === 401
              ? "Session expired or missing instructor scope. Sign in again and select a course."
              : response.status === 400
                ? "Select a course from the top bar, then reopen this tab."
                : `Could not load analytics (${response.status}).`
        setFetchError(message)
        setStats(null)
        console.error("Failed to fetch stats:", response.status, message)
      }
    } catch (error) {
      setFetchError("Network error while loading lecture analytics.")
      setStats(null)
      console.error("Failed to fetch lecture stats:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto" />
          <p className="text-slate-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className={`${PANEL} border-dashed`}>
        <CardContent className="py-12 text-center space-y-4">
          <TrendingUp className="h-10 w-10 text-slate-400 mx-auto" />
          {fetchError ? (
            <>
              <p className="text-slate-700 font-medium">Could not load lecture analytics</p>
              <p className="text-sm text-slate-500 max-w-md mx-auto">{fetchError}</p>
              <Button variant="outline" onClick={() => void fetchStats()}>
                Retry
              </Button>
            </>
          ) : lectureCountFallback > 0 ? (
            <>
              <p className="text-slate-700 font-medium">Analytics are still loading</p>
              <p className="text-sm text-slate-500">
                You have {lectureCountFallback} lecture{lectureCountFallback === 1 ? "" : "s"} in this course.
                Engagement charts will appear once analytics finish loading.
              </p>
            </>
          ) : (
            <>
              <p className="text-slate-600">No statistics available</p>
              <p className="text-sm text-slate-500 mt-2">Create some lectures to see analytics</p>
            </>
          )}
        </CardContent>
      </div>
    )
  }

  if (stats.total_lectures === 0) {
    return (
      <div className={`${PANEL} border-dashed`}>
        <CardContent className="py-12 text-center space-y-3">
          <BookOpen className="h-10 w-10 text-slate-400 mx-auto" />
          <p className="text-slate-700 font-medium">No lectures in this course yet</p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Upload slide decks or create lectures on the Lectures tab. Views, comments, and weekly trends will show up here as students engage.
          </p>
        </CardContent>
      </div>
    )
  }
  const sessionStatsRows = stats.session_stats || []
  const topLectureRows = stats.top_lectures || []

  const avgViewsPerLecture = stats.total_lectures > 0 
    ? Math.round(stats.total_views / stats.total_lectures) 
    : 0
  const avgCommentsPerLecture = stats.total_lectures > 0 
    ? Math.round(stats.total_comments / stats.total_lectures) 
    : 0
  const avgSlidesPerLecture = stats.total_lectures > 0 
    ? Math.round(stats.total_slides / stats.total_lectures) 
    : 0

  // Prepare chart data with safe fallbacks
  const weeklyChartData = (stats.weekly_activity || []).map(w => ({
    week: `W${w.week}`,
    views: Number(w.views) || 0,
    comments: Number(w.comments) || 0,
    engagement: (Number(w.views) || 0) + (Number(w.comments) || 0),
    lectures: Number(w.lectures) || 0
  }))

  const sessionPieData = (stats.session_stats || [])
    .filter(s => s.session && s.views > 0)
    .map(s => ({
      name: s.session || 'Unknown',
      value: Number(s.views) || 0,
      lectures: Number(s.lectures) || 0,
      comments: Number(s.comments) || 0
    }))

  const engagementTrendData = (stats.engagement_trends || []).map(t => ({
    date: new Date(t.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    comments: Number(t.comments) || 0,
    rating: (Number(t.avg_rating) || 0) * 20, // Scale to 0-100 for better visualization
  }))

  // Heat map data for weekly activity
  const heatMapData = Array.from({ length: 16 }, (_, i) => {
    const week = i + 1
    const weekData = (stats.weekly_activity || []).find(w => w.week === week)
    return {
      week,
      value: weekData ? (Number(weekData.views) || 0) + (Number(weekData.comments) || 0) : 0,
      lectures: Number(weekData?.lectures) || 0
    }
  })

  const maxActivity = Math.max(...heatMapData.map(d => d.value), 1)

  const chartTooltipStyle = {
    backgroundColor: "hsl(var(--background))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
  }

  const tabTriggerClass =
    "rounded-md px-2.5 py-1.5 text-xs sm:text-sm gap-1.5 data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-teal-300 text-slate-600 dark:text-slate-400"

  return (
    <div className="space-y-4">
      <div className={PANEL}>
        <div className="flex items-center gap-3 p-4">
          <div className="p-2 rounded-lg bg-teal-500/15 dark:bg-teal-500/25 shrink-0">
            <TrendingUp className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white">Lecture analytics</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Views, comments, and engagement for the selected course
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatKpi
          label="Lectures"
          value={stats.total_lectures}
          sub={`${avgSlidesPerLecture} slides avg`}
          icon={BookOpen}
          tone="blue"
        />
        <StatKpi
          label="Views"
          value={stats.total_views.toLocaleString()}
          sub={`${avgViewsPerLecture} per lecture`}
          icon={Eye}
          tone="amber"
        />
        <StatKpi
          label="Comments"
          value={stats.total_comments.toLocaleString()}
          sub={`${avgCommentsPerLecture} per lecture`}
          icon={MessageSquare}
          tone="violet"
        />
        <StatKpi
          label="Engagement"
          value={`${stats.avg_engagement.toFixed(1)}/5`}
          sub="Average likes score"
          icon={Star}
          tone="emerald"
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto w-full flex flex-wrap justify-start gap-1 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.03] p-1">
          <TabsTrigger value="overview" className={tabTriggerClass}>
            <BarChart3 className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="weekly" className={tabTriggerClass}>
            <Calendar className="h-3.5 w-3.5" />
            Weekly
          </TabsTrigger>
          <TabsTrigger value="sessions" className={tabTriggerClass}>
            <Users className="h-3.5 w-3.5" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="trends" className={tabTriggerClass}>
            <TrendingUp className="h-3.5 w-3.5" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="top" className={tabTriggerClass}>
            <Award className="h-3.5 w-3.5" />
            Top lectures
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartPanel title="Weekly activity" description="Views and comments per week" icon={BarChart3}>
              {weeklyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={weeklyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="views" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="comments" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
                  No weekly activity yet
                </div>
              )}
            </ChartPanel>

            <ChartPanel title="Session distribution" description="Views by section" icon={Users}>
              {sessionPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={sessionPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={72}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {sessionPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS.primary[index % COLORS.primary.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-slate-400 text-sm">
                  No session data yet
                </div>
              )}
            </ChartPanel>
          </div>

          <ChartPanel title="Semester heat map" description="16-week activity intensity" icon={Activity}>
            <div className="grid grid-cols-8 gap-1.5 sm:gap-2">
              {heatMapData.map((data) => {
                const intensity = data.value / maxActivity
                const bgColor =
                  intensity === 0
                    ? "bg-slate-100 dark:bg-white/5"
                    : intensity < 0.25
                      ? "bg-teal-200 dark:bg-teal-900/40"
                      : intensity < 0.5
                        ? "bg-teal-400 dark:bg-teal-700/60"
                        : intensity < 0.75
                          ? "bg-teal-600"
                          : "bg-teal-800"

                return (
                  <div
                    key={data.week}
                    title={`Week ${data.week}: ${data.value} activities`}
                    className={`${bgColor} px-1 py-2 rounded-md text-center`}
                  >
                    <p className={`text-[10px] font-medium ${intensity > 0.5 ? "text-white" : "text-slate-600 dark:text-slate-300"}`}>
                      W{data.week}
                    </p>
                    {data.value > 0 ? (
                      <p className={`text-xs font-semibold tabular-nums ${intensity > 0.5 ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>
                        {data.value}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-center gap-3 mt-4 text-xs text-slate-500">
              <span>Less</span>
              <div className="flex gap-1">
                <div className="size-4 bg-slate-100 dark:bg-white/5 rounded-sm" />
                <div className="size-4 bg-teal-200 rounded-sm" />
                <div className="size-4 bg-teal-400 rounded-sm" />
                <div className="size-4 bg-teal-600 rounded-sm" />
                <div className="size-4 bg-teal-800 rounded-sm" />
              </div>
              <span>More</span>
            </div>
          </ChartPanel>
        </TabsContent>

        <TabsContent value="weekly" className="mt-0">
          <ChartPanel title="Weekly engagement" description="Views and comments over time" icon={TrendingUp}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={weeklyChartData}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorComments" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Area type="monotone" dataKey="views" stroke="#14b8a6" fillOpacity={1} fill="url(#colorViews)" />
                <Area type="monotone" dataKey="comments" stroke="#6366f1" fillOpacity={1} fill="url(#colorComments)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-3 mt-0">
          {sessionStatsRows.map((session) => (
            <div key={session.session || "all"} className={PANEL}>
              <div className={`${PANEL_HEADER} flex items-center justify-between gap-3`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`size-10 rounded-lg flex items-center justify-center font-semibold text-white text-xs shrink-0 bg-gradient-to-br ${getSessionStatGradient(session.session)}`}
                  >
                    {session.session || "ALL"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {session.session
                        ? getSectionColumnHeading(session.session, labelByCode)
                        : "All sessions"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {session.lectures} lectures · {session.slides} slides
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Views</span>
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{session.views}</span>
                  </div>
                  <Progress
                    value={(session.views / Math.max(1, ...sessionStatsRows.map((s) => s.views))) * 100}
                    className="h-1.5"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Comments</span>
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{session.comments}</span>
                  </div>
                  <Progress
                    value={(session.comments / Math.max(1, ...sessionStatsRows.map((s) => s.comments))) * 100}
                    className="h-1.5"
                  />
                </div>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="trends" className="mt-0">
          <ChartPanel title="Engagement trends" description="Last 12 weeks — comments and rating" icon={TrendingUp}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={engagementTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line type="monotone" dataKey="comments" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="rating" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
        </TabsContent>

        <TabsContent value="top" className="mt-0">
          <div className={PANEL}>
            <div className={PANEL_HEADER}>
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Top lectures</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Most viewed content</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-slate-200/60 dark:divide-white/[0.08]">
              {topLectureRows.slice(0, 10).map((lecture, index) => (
                <div
                  key={lecture.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 hover:bg-slate-50/80 dark:hover:bg-white/[0.02]"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{lecture.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Week {lecture.week}</span>
                        {lecture.session ? (
                          <span className="text-xs text-slate-500 dark:text-slate-400">· {lecture.session}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-5 pl-10 sm:pl-0 text-xs shrink-0">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 tabular-nums">
                      <Eye className="h-3.5 w-3.5 text-slate-400" />
                      {lecture.views}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 tabular-nums">
                      <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                      {lecture.comments}
                    </span>
                    {lecture.avg_rating > 0 ? (
                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 tabular-nums">
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        {lecture.avg_rating.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
