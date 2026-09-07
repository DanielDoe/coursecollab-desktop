"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { DashboardKpiCard } from "@/components/dashboard-v2/DashboardKpiCard"
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Lightbulb,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Activity,
} from "lucide-react"
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

type PerformanceData = {
  overview: {
    total_attempts: number
    average_score: number
    completed_attempts: number
  }
  assessmentTypePerformance: Array<{
    type: string
    attempts: number
    unique_students: number
    avg_score: number
    min_score: number
    max_score: number
  }>
  sessionPerformance: Array<{
    session_code: string
    session_name: string
    attempts: number
    unique_students: number
    avg_score: number
  }>
  topicPerformance: Array<{
    topic: string
    attempts: number
    unique_students: number
    avg_score: number
  }>
  questionTypePerformance: Array<{
    question_type: string
    attempts: number
    unique_students: number
    avg_score: number
  }>
  difficultyAnalysis: Array<{
    difficulty: string
    attempts: number
    unique_students: number
    avg_score: number
  }>
  performanceSummary?: {
    unique_learners: number
    pass_rate: number
    min_score: number
    max_score: number
    median_score: number
  }
  scoreDistribution?: Array<{
    range: string
    count: number
    sort_order?: number
  }>
}

function num(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value) : Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatQuestionTypeLabel(raw: string): string {
  const key = (raw || "").toLowerCase()
  const labels: Record<string, string> = {
    mcq: "Multiple choice",
    multiple_choice: "Multiple choice",
    true_false: "True / false",
    select_all: "Select all",
    fill_blank: "Fill in the blank",
    code_write: "Code write",
    code_problem: "Code problem",
    code_debug: "Debug code",
    code_write_plot: "Code + plot",
    code_explain: "Code explain",
    circuit_submission: "Circuit upload",
    multi_part: "Multi-part",
    short_answer: "Short answer",
  }
  return labels[key] ?? raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 70) return "text-teal-600 dark:text-teal-400"
  if (score >= 60) return "text-amber-600 dark:text-amber-400"
  return "text-rose-600 dark:text-rose-400"
}

function barColorForScore(score: number): string {
  if (score >= 80) return "#10b981"
  if (score >= 70) return "#14b8a6"
  if (score >= 60) return "#f59e0b"
  return "#f43f5e"
}

function buildInstructorInsights(data: PerformanceData): string[] {
  const insights: string[] = []
  const types = data.assessmentTypePerformance.map((t) => ({
    type: t.type,
    avg: num(t.avg_score),
  }))
  if (types.length >= 2) {
    const sorted = [...types].sort((a, b) => b.avg - a.avg)
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]
    if (best.avg - worst.avg >= 12) {
      insights.push(
        `${best.type.replace(/_/g, " ")} scores are ${formatNumber(best.avg - worst.avg)} pts higher than ${worst.type.replace(/_/g, " ")} — consider aligning quiz review with homework success patterns.`,
      )
    }
  }

  const passRate = num(data.performanceSummary?.pass_rate)
  if (passRate > 0 && passRate < 55) {
    insights.push(
      `Only ${formatNumber(passRate)}% of completed attempts meet the 70% threshold — a targeted review session may help.`,
    )
  } else if (passRate >= 75) {
    insights.push(`Strong pass rate (${formatNumber(passRate)}% at ≥70%) — class is largely meeting performance expectations.`)
  }

  const weakestQ = [...data.questionTypePerformance]
    .filter((q) => num(q.attempts) >= 3)
    .sort((a, b) => num(a.avg_score) - num(b.avg_score))[0]
  if (weakestQ && num(weakestQ.avg_score) < 65) {
    insights.push(
      `${formatQuestionTypeLabel(weakestQ.question_type)} has the lowest success rate (${formatNumber(weakestQ.avg_score)}%) — worth extra examples or office-hour focus.`,
    )
  }

  const sessions = data.sessionPerformance.filter((s) => num(s.attempts) >= 2)
  if (sessions.length >= 2) {
    const sorted = [...sessions].sort((a, b) => num(a.avg_score) - num(b.avg_score))
    const low = sorted[0]
    const high = sorted[sorted.length - 1]
    if (num(high.avg_score) - num(low.avg_score) >= 15) {
      insights.push(
        `Section ${low.session_code} trails ${high.session_code} by ${formatNumber(num(high.avg_score) - num(low.avg_score))} pts — check for section-specific gaps.`,
      )
    }
  }

  const weakTopic = [...data.topicPerformance]
    .filter((t) => t.topic !== "General" && num(t.attempts) >= 2)
    .sort((a, b) => num(a.avg_score) - num(b.avg_score))[0]
  if (weakTopic && num(weakTopic.avg_score) < 65) {
    insights.push(`Topic "${weakTopic.topic}" is a priority review area (${formatNumber(weakTopic.avg_score)}% average).`)
  }

  return insights.slice(0, 4)
}

function formatNumber(value: unknown, decimals = 1): string {
  const n = num(value)
  return n.toFixed(decimals)
}

const DIST_COLORS = ["#f43f5e", "#fb923c", "#fbbf24", "#2dd4bf", "#14b8a6", "#10b981"]

type ChartTooltipProps = {
  active?: boolean
  payload?: Array<{ value: number; payload: Record<string, unknown> }>
  label?: string
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-slate-800 dark:text-slate-100">{String(label ?? payload[0].payload?.range ?? "")}</p>
      <p className="text-slate-600 dark:text-slate-300">{payload[0].value} attempts</p>
    </div>
  )
}

export function InstructorAnalyticsPerformanceView({
  data,
  cardBase,
  cardHeaderBase,
  cardIconBase,
  cardIcon,
  getDifficultyColor,
  getScoreColor,
  emptyMessage,
}: {
  data: PerformanceData
  cardBase: string
  cardHeaderBase: string
  cardIconBase: string
  cardIcon: string
  getDifficultyColor: (difficulty: string) => string
  getScoreColor: (score: number) => string
  emptyMessage: React.ReactNode
}) {
  const attempts = num(data.overview.total_attempts)
  if (attempts === 0) {
    return <div className="py-8">{emptyMessage}</div>
  }

  const summary = data.performanceSummary
  const passRate = num(summary?.pass_rate)
  const classAvg = num(data.overview.average_score)
  const median = num(summary?.median_score)
  const uniqueLearners = num(summary?.unique_learners)
  const minScore = num(summary?.min_score)
  const maxScore = num(summary?.max_score)

  const distribution = (data.scoreDistribution ?? [])
    .map((row) => ({
      range: row.range,
      count: num(row.count),
      sort_order: num(row.sort_order),
    }))
    .sort((a, b) => a.sort_order - b.sort_order)
  const distTotal = distribution.reduce((s, d) => s + d.count, 0) || 1

  const typeChart = data.assessmentTypePerformance.map((t) => ({
    name: t.type.replace(/_/g, " "),
    avg: num(t.avg_score),
    attempts: num(t.attempts),
    students: num(t.unique_students),
  }))

  const sessionChart = data.sessionPerformance.map((s) => ({
    name: s.session_code,
    avg: num(s.avg_score),
    attempts: num(s.attempts),
  }))

  const questionTypes = [...data.questionTypePerformance]
    .map((q) => ({
      key: q.question_type,
      label: formatQuestionTypeLabel(q.question_type),
      avg: num(q.avg_score),
      attempts: num(q.attempts),
      students: num(q.unique_students),
    }))
    .sort((a, b) => a.avg - b.avg)

  const topicsReview = [...data.topicPerformance]
    .filter((t) => num(t.attempts) > 0)
    .sort((a, b) => num(a.avg_score) - num(b.avg_score))
    .slice(0, 8)

  const insights = buildInstructorInsights(data)

  return (
    <div className="space-y-6">
      {/* Class health snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <DashboardKpiCard
          label="Class average"
          value={`${formatNumber(classAvg)}%`}
          sub={`Median ${formatNumber(median)}%`}
          icon={BarChart3}
          iconBg="bg-sky-500/10 dark:bg-sky-500/15"
          iconColor="text-sky-600 dark:text-sky-400"
          valueClassName={scoreTone(classAvg)}
        />
        <DashboardKpiCard
          label="Pass rate (≥70%)"
          value={`${formatNumber(passRate)}%`}
          sub={`${num(data.overview.completed_attempts)} completed attempts`}
          icon={CheckCircle2}
          iconBg="bg-emerald-500/10 dark:bg-emerald-500/15"
          iconColor="text-emerald-600 dark:text-emerald-400"
          valueClassName={scoreTone(passRate)}
        />
        <DashboardKpiCard
          label="Score spread"
          value={`${formatNumber(minScore)}–${formatNumber(maxScore)}%`}
          sub="Lowest to highest attempt"
          icon={Activity}
          iconBg="bg-amber-500/10 dark:bg-amber-500/15"
          iconColor="text-amber-600 dark:text-amber-400"
        />
        <DashboardKpiCard
          label="Active learners"
          value={uniqueLearners}
          sub={`${attempts} total attempts`}
          icon={Users}
          iconBg="bg-violet-500/10 dark:bg-violet-500/15"
          iconColor="text-violet-600 dark:text-violet-400"
        />
      </div>

      {insights.length > 0 && (
        <Card className={`${cardBase} border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20`}>
          <CardHeader className="pb-2">
            <CardTitle className={`${cardHeaderBase} text-amber-900 dark:text-amber-100`}>
              <div className="p-2 rounded-lg bg-amber-500/15 shrink-0">
                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              What to focus on
            </CardTitle>
            <CardDescription className="text-amber-800/80 dark:text-amber-200/80">
              Actionable signals from this period&apos;s data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.map((line, i) => (
              <p key={i} className="text-sm text-amber-900/90 dark:text-amber-100/90 flex gap-2">
                <span className="text-amber-500 shrink-0">•</span>
                <span>{line}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Score distribution */}
        <Card className={cardBase}>
          <CardHeader className="pb-2">
            <CardTitle className={cardHeaderBase}>
              <div className={cardIconBase}>
                <BarChart3 className={cardIcon} />
              </div>
              Score distribution
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              How completed attempts cluster — spot gaps and outliers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {distribution.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No scored completions yet.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribution} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} className="text-xs" tick={{ fill: "currentColor" }} />
                    <YAxis type="category" dataKey="range" width={72} className="text-xs" tick={{ fill: "currentColor" }} />
                    <Tooltip content={<ChartTooltip />} />
                    <ReferenceLine x={0} stroke="transparent" />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {distribution.map((_, i) => (
                        <Cell key={i} fill={DIST_COLORS[i % DIST_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {distribution.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {distribution.map((d) => (
                  <span key={d.range} className="text-xs text-slate-500 dark:text-slate-400">
                    {d.range}: {Math.round((d.count / distTotal) * 100)}%
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By assessment type */}
        <Card className={cardBase}>
          <CardHeader className="pb-2">
            <CardTitle className={cardHeaderBase}>
              <div className={cardIconBase}>
                <Target className={cardIcon} />
              </div>
              By assessment type
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Compare homework, quizzes, exams side by side
            </CardDescription>
          </CardHeader>
          <CardContent>
            {typeChart.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">No type breakdown available.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
                    <XAxis dataKey="name" className="text-xs" tick={{ fill: "currentColor" }} />
                    <YAxis domain={[0, 100]} className="text-xs" tick={{ fill: "currentColor" }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const p = payload[0].payload as { name: string; avg: number; attempts: number; students: number }
                        return (
                          <div className="rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 px-3 py-2 shadow-lg text-sm">
                            <p className="font-medium capitalize">{p.name}</p>
                            <p className="text-teal-600 dark:text-teal-400">{formatNumber(p.avg)}% avg</p>
                            <p className="text-slate-500">{p.attempts} attempts · {p.students} students</p>
                          </div>
                        )
                      }}
                    />
                    <ReferenceLine y={70} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "70%", position: "right", fill: "#94a3b8", fontSize: 10 }} />
                    <Bar dataKey="avg" name="Avg %" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {typeChart.map((entry) => (
                        <Cell key={entry.name} fill={barColorForScore(entry.avg)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Session comparison */}
      {sessionChart.length > 0 && (
        <Card className={cardBase}>
          <CardHeader className="pb-2">
            <CardTitle className={cardHeaderBase}>
              <div className={cardIconBase}>
                <Users className={cardIcon} />
              </div>
              Section comparison
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Average score by lab / section — spot uneven groups early
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessionChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
                  <XAxis dataKey="name" className="text-xs" tick={{ fill: "currentColor" }} />
                  <YAxis domain={[0, 100]} className="text-xs" tick={{ fill: "currentColor" }} />
                  <ReferenceLine y={classAvg} stroke="#0d9488" strokeDasharray="4 4" label={{ value: "Class avg", position: "insideTopRight", fill: "#0d9488", fontSize: 10 }} />
                  <Bar dataKey="avg" name="Avg %" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {sessionChart.map((entry) => (
                      <Cell key={entry.name} fill={barColorForScore(entry.avg)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Question formats */}
        <Card className={cardBase}>
          <CardHeader className="pb-2">
            <CardTitle className={cardHeaderBase}>
              <div className={cardIconBase}>
                <TrendingDown className={cardIcon} />
              </div>
              Question formats
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Success rate by question type — weakest formats first
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {questionTypes.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">No graded answers in this period.</p>
            ) : (
              questionTypes.map((q) => (
                <div key={q.key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{q.label}</span>
                    <span className={`font-semibold tabular-nums shrink-0 ${getScoreColor(q.avg)}`}>
                      {formatNumber(q.avg)}%
                    </span>
                  </div>
                  <Progress value={Math.min(100, q.avg)} className="h-2 bg-slate-200 dark:bg-white/10" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {q.attempts} graded answers · {q.students} students
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Topics priority */}
        <Card className={cardBase}>
          <CardHeader className="pb-2">
            <CardTitle className={cardHeaderBase}>
              <div className={cardIconBase}>
                <AlertTriangle className={cardIcon} />
              </div>
              Topics to review
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Lowest-performing topics — plan lecture or office-hour coverage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topicsReview.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
                Tag assessments with topics in the question bank to unlock this view.
              </p>
            ) : (
              topicsReview.map((topic, i) => {
                const avg = num(topic.avg_score)
                const needsAttention = avg < 70
                return (
                  <div
                    key={topic.topic}
                    className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                      needsAttention
                        ? "border-rose-200/60 dark:border-rose-800/40 bg-rose-50/40 dark:bg-rose-950/20"
                        : "border-slate-200/60 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-5">#{i + 1}</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{topic.topic}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 pl-7">
                        {num(topic.attempts)} attempts · {num(topic.unique_students)} students
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-lg font-bold tabular-nums ${getScoreColor(avg)}`}>{formatNumber(avg)}%</span>
                      {needsAttention ? (
                        <span className="text-[10px] uppercase tracking-wide text-rose-600 dark:text-rose-400 font-semibold">Review</span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5 justify-end">
                          <CheckCircle2 className="h-3 w-3" /> OK
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Difficulty calibration */}
      {data.difficultyAnalysis.length > 0 && (
        <Card className={cardBase}>
          <CardHeader className="pb-2">
            <CardTitle className={cardHeaderBase}>
              <div className={cardIconBase}>
                <TrendingUp className={cardIcon} />
              </div>
              Difficulty calibration
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Do &quot;easy&quot; questions score higher than &quot;hard&quot; ones? Mislabeled items stand out here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.difficultyAnalysis.map((d) => (
                <div
                  key={d.difficulty}
                  className="p-4 rounded-lg border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]"
                >
                  <Badge className={getDifficultyColor(d.difficulty)}>{d.difficulty}</Badge>
                  <p className={`text-2xl font-bold tabular-nums mt-3 ${getScoreColor(num(d.avg_score))}`}>
                    {formatNumber(d.avg_score)}%
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {num(d.attempts)} answers · {num(d.unique_students)} students
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
