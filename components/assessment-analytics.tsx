"use client"

import { useState, useEffect, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BarChart3,
  AlertCircle,
  Target,
  Users,
  CheckCircle2,
  Loader2,
  RefreshCw,
  MessageSquare,
  Eye,
  Flame,
  TrendingUp,
} from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { instructorQuizzesAssessmentTypeParam } from "@/lib/instructor-quizzes-api-params"
import {
  AM_CHART_BODY,
  AM_CHART_PANEL,
  AM_CHART_TICK,
  AM_CHART_TITLE,
  AM_CHART_TOOLTIP,
  AM_CHART_GRID_STROKE,
  AM_LIST_ROW,
  AM_PANEL,
  AM_STAT_BOX,
  PORTAL_CARD,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
  amChartFill,
} from "@/lib/assessments/assessment-management-surface-classes"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { QuestionDifficultyHeatmap } from "@/components/instructor/QuestionDifficultyHeatmap"
import { Skeleton } from "@/components/ui/skeleton"

interface QuizOption {
  id: number
  title: string
}

interface AssessmentAnalyticsProps {
  assessmentId?: number
  assessmentType: string
  embedInDashboard?: boolean
  quizOptions?: QuizOption[]
  selectedQuizId?: number | null
  onSelectedQuizIdChange?: (id: number | null) => void
  refreshNonce?: number
  hideToolbar?: boolean
}

function facultyModuleIdForType(assessmentType: string) {
  if (assessmentType === "homework") return "homeworks"
  if (assessmentType === "mid_semester") return "mid-semester"
  if (assessmentType === "final") return "final-exams"
  return "quizzes"
}

function ChartPanel({
  title,
  icon: Icon,
  action,
  children,
  embed,
}: {
  title: string
  icon?: typeof BarChart3
  action?: ReactNode
  children: ReactNode
  embed?: boolean
}) {
  return (
    <div className={cn(embed ? AM_CHART_PANEL : "rounded-2xl border border-slate-200/60 bg-white/85 p-5 dark:border-slate-700/60 dark:bg-slate-800/85")}>
      <div className={cn("flex items-center justify-between gap-2 border-b", embed ? "border-[var(--border)] px-3 py-2.5 sm:px-4" : "mb-4 border-transparent")}>
        <h3 className={cn("flex items-center gap-2", embed ? AM_CHART_TITLE : "text-sm font-semibold text-slate-800")}>
          {Icon ? <Icon className="h-3.5 w-3.5 text-[var(--cc-accent)]" /> : null}
          {title}
        </h3>
        {action}
      </div>
      <div className={embed ? AM_CHART_BODY : undefined}>{children}</div>
    </div>
  )
}

function EmptyChart({ label, embed }: { label: string; embed?: boolean }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center py-8 text-center">
      <BarChart3 className="mb-2 h-8 w-8 opacity-30 text-[var(--cc-text-muted)]" />
      <p className={cn("text-sm", embed ? PORTAL_TEXT_MUTED : "text-slate-500")}>{label}</p>
    </div>
  )
}

function AnalyticsSkeleton({ embed }: { embed?: boolean }) {
  return (
    <div className="space-y-4">
      <div className={cn(embed ? AM_PANEL : "rounded-2xl border p-4", "grid grid-cols-2 gap-3 sm:grid-cols-4")}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[280px] rounded-xl" />
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
      <Skeleton className="h-[320px] rounded-xl" />
    </div>
  )
}

export function AssessmentAnalytics({
  assessmentId,
  assessmentType,
  embedInDashboard,
  quizOptions,
  selectedQuizId: selectedQuizIdProp,
  onSelectedQuizIdChange,
  refreshNonce = 0,
  hideToolbar = false,
}: AssessmentAnalyticsProps) {
  const { toast } = useToast()
  const [internalQuizId, setInternalQuizId] = useState<number | null>(assessmentId || null)
  const [internalQuizzes, setInternalQuizzes] = useState<QuizOption[]>([])
  const useParentQuizzes = quizOptions !== undefined
  const quizList = useParentQuizzes ? quizOptions : internalQuizzes
  const selectedQuizId = selectedQuizIdProp !== undefined ? selectedQuizIdProp : internalQuizId
  const setSelectedQuizId = (id: number | null) => {
    if (onSelectedQuizIdChange) onSelectedQuizIdChange(id)
    else setInternalQuizId(id)
  }
  const [questionAnalysis, setQuestionAnalysis] = useState<any[]>([])
  const [performanceDistribution, setPerformanceDistribution] = useState<any[]>([])
  const [timeAnalysis, setTimeAnalysis] = useState<any[]>([])
  const [strugglingStudents, setStrugglingStudents] = useState<any[]>([])
  const [overallStats, setOverallStats] = useState({
    totalAttempts: 0,
    avgScore: 0,
    passRate: 0,
    completionRate: 0,
    avgTimeMinutes: 0,
  })
  const [loadingQuizzes, setLoadingQuizzes] = useState(!useParentQuizzes)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  const facultyModuleId = facultyModuleIdForType(assessmentType)
  const chrome = embedInDashboard ? facultyEmbedChrome(facultyModuleId) : null
  const panel = embedInDashboard ? AM_PANEL : "rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 p-5"
  const divideClass = embedInDashboard ? "divide-[var(--border)]" : "divide-slate-200/70 dark:divide-white/[0.08]"
  const borderClass = embedInDashboard ? "border-[var(--border)]" : "border-slate-200/70 dark:border-white/[0.08]"

  useEffect(() => {
    if (!useParentQuizzes) fetchQuizzes()
  }, [assessmentType, useParentQuizzes])

  useEffect(() => {
    if (selectedQuizId) fetchAnalytics()
    else setLoadingAnalytics(false)
  }, [selectedQuizId, assessmentType, refreshNonce])

  const fetchQuizzes = async () => {
    setLoadingQuizzes(true)
    try {
      const typeParam = instructorQuizzesAssessmentTypeParam(assessmentType)
      const response = await instructorApiFetch(`/api/instructor/quizzes?assessmentType=${encodeURIComponent(typeParam)}`, {
        headers: buildInstructorAuthorizedApiHeaders(),
      })
      const data = await response.json()

      if (response.ok) {
        const list = data.quizzes || []
        setInternalQuizzes(list)
        if (selectedQuizIdProp === undefined) {
          setInternalQuizId((prev) => {
            if (list.length === 0) return null
            const exists = list.some((q: QuizOption) => q.id === prev)
            return exists ? prev : list[0].id
          })
        }
      } else {
        toast({
          title: "Could not load assessments",
          description: data.error || "Failed to fetch assessment list",
          variant: "destructive",
        })
        setInternalQuizzes([])
        if (selectedQuizIdProp === undefined) setInternalQuizId(null)
      }
    } catch (error) {
      console.error("Failed to fetch quizzes:", error)
      setInternalQuizzes([])
      if (selectedQuizIdProp === undefined) setInternalQuizId(null)
    } finally {
      setLoadingQuizzes(false)
    }
  }

  const fetchAnalytics = async () => {
    if (!selectedQuizId) return

    setLoadingAnalytics(true)
    try {
      const response = await fetch(
        `/api/instructor/assessment-analytics?quizId=${selectedQuizId}&assessmentType=${assessmentType}`,
        { headers: buildInstructorAuthorizedApiHeaders() },
      )
      const data = await response.json()

      if (response.ok) {
        setQuestionAnalysis(data.questionAnalysis || [])
        setPerformanceDistribution(data.performanceDistribution || [])
        setTimeAnalysis(data.timeAnalysis || [])
        setStrugglingStudents(data.strugglingStudents || [])
        setOverallStats(data.overallStats || overallStats)
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to load analytics data",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[Analytics] Fetch error:", error)
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive",
      })
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const isLoading = loadingQuizzes || loadingAnalytics

  const kpiGrid = (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3", embedInDashboard ? "p-3 sm:p-4" : "")}>
      {[
        { icon: Users, label: "Attempts", value: overallStats.totalAttempts },
        { icon: Target, label: "Avg score", value: `${overallStats.avgScore}%` },
        { icon: CheckCircle2, label: "Pass rate", value: `${overallStats.passRate}%` },
        { icon: TrendingUp, label: "Completed", value: `${overallStats.completionRate}%` },
      ].map(({ icon: Icon, label, value }) => (
        <div key={label} className={embedInDashboard ? AM_STAT_BOX : "rounded-xl border border-slate-200 p-3 dark:border-slate-700"}>
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-[var(--cc-accent)]" />
            <p className={cn("text-[10px] font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>{label}</p>
          </div>
          <p className={cn("mt-1 text-xl font-semibold tabular-nums sm:text-2xl", PORTAL_TEXT)}>{value}</p>
        </div>
      ))}
    </div>
  )

  const pickerRow = !hideToolbar && (
    <div className={cn("flex flex-col gap-2 border-t p-3 sm:flex-row sm:items-center sm:px-4 sm:py-3", borderClass)}>
      <Select
        value={selectedQuizId?.toString() || ""}
        onValueChange={(value) => setSelectedQuizId(parseInt(value, 10))}
        disabled={loadingQuizzes || quizList.length === 0}
      >
        <SelectTrigger className={cn("h-9 min-w-0", embedInDashboard ? "w-full sm:max-w-md" : "rounded-full")}>
          <SelectValue placeholder={loadingQuizzes ? "Loading assessments…" : "Choose an assessment…"} />
        </SelectTrigger>
        <SelectContent>
          {quizList.map((quiz) => (
            <SelectItem key={quiz.id} value={quiz.id.toString()}>
              {quiz.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        onClick={() => (selectedQuizId ? fetchAnalytics() : fetchQuizzes())}
        className={cn("h-9 shrink-0", !embedInDashboard && "rounded-full", embedInDashboard && chrome?.quiet)}
        disabled={isLoading}
      >
        <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
        Refresh
      </Button>
    </div>
  )

  const sortedQuestions = [...questionAnalysis].sort((a, b) => a.question_order - b.question_order)

  if (embedInDashboard && (loadingQuizzes || (selectedQuizId && loadingAnalytics))) {
    return (
      <div className="space-y-4">
        {!hideToolbar && pickerRow}
        <AnalyticsSkeleton embed />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className={cn(panel, "overflow-hidden p-0")}>
        {loadingQuizzes ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent)]" />
          </div>
        ) : !selectedQuizId ? (
          <div className="py-10 text-center">
            <BarChart3 className="mx-auto mb-3 h-10 w-10 opacity-40 text-[var(--cc-text-muted)]" />
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No assessments found for this course</p>
            {pickerRow}
          </div>
        ) : (
          kpiGrid
        )}
        {!loadingQuizzes && selectedQuizId && !loadingAnalytics && pickerRow}
      </div>

      {!loadingQuizzes && selectedQuizId && !loadingAnalytics && (
        <div className="space-y-4 sm:space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartPanel title="Score distribution" embed={embedInDashboard}>
              {performanceDistribution.length === 0 ? (
                <EmptyChart label="No score data yet." embed={embedInDashboard} />
              ) : (
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceDistribution} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={AM_CHART_GRID_STROKE} vertical={false} />
                      <XAxis dataKey="range" tick={AM_CHART_TICK} />
                      <YAxis allowDecimals={false} tick={AM_CHART_TICK} width={32} />
                      <Tooltip contentStyle={AM_CHART_TOOLTIP} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {performanceDistribution.map((_, i) => (
                          <Cell key={i} fill={amChartFill(i)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartPanel>

            <ChartPanel title="Time per question" embed={embedInDashboard}>
              {timeAnalysis.length === 0 ? (
                <EmptyChart label="No timing data yet." embed={embedInDashboard} />
              ) : (
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeAnalysis} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={AM_CHART_GRID_STROKE} />
                      <XAxis dataKey="question_order" tick={AM_CHART_TICK} />
                      <YAxis tick={AM_CHART_TICK} width={36} />
                      <Tooltip contentStyle={AM_CHART_TOOLTIP} />
                      <Line
                        type="monotone"
                        dataKey="avg_time"
                        stroke="var(--cc-accent)"
                        strokeWidth={2.5}
                        dot={{ fill: "var(--cc-accent)", r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartPanel>
          </div>

          <ChartPanel title="Question difficulty heatmap" icon={Flame} embed={embedInDashboard}>
            {sortedQuestions.length === 0 ? (
              <EmptyChart label="No question analytics yet." embed={embedInDashboard} />
            ) : (
              <QuestionDifficultyHeatmap
                questions={sortedQuestions}
                embed={embedInDashboard}
                chrome={chrome}
              />
            )}
          </ChartPanel>

          {strugglingStudents.length > 0 ? (
            <div className={cn(panel, "space-y-3 overflow-hidden p-0")}>
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2.5 sm:px-4">
                <h3 className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT)}>
                  <AlertCircle className="h-3.5 w-3.5 text-[var(--cc-sem-warning)]" />
                  Students needing support
                </h3>
                <span className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>{strugglingStudents.length}</span>
              </div>
              <div className={cn(embedInDashboard ? cn(PORTAL_CARD, "mx-3 mb-3 overflow-hidden") : "rounded-xl border overflow-hidden", !embedInDashboard && borderClass)}>
                <div className={cn("divide-y", divideClass)}>
                  {strugglingStudents.map((student: any, idx: number) => (
                    <div key={`student-${student.student_id}-${idx}`} className={cn(AM_LIST_ROW, "flex-col sm:flex-row sm:items-center sm:justify-between")}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={cn("truncate text-sm font-medium", PORTAL_TEXT)}>{student.student_name}</p>
                          <Badge variant="outline" className="border-[var(--cc-sem-warning)]/30 bg-[var(--cc-sem-warning)]/10 text-[var(--cc-sem-warning)]">
                            {student.score}%
                          </Badge>
                        </div>
                        <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
                          {student.student_id} · {student.questions_wrong}/{student.questions_attempted} incorrect
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" className={cn("h-8 rounded-lg text-xs", embedInDashboard && chrome?.quiet)}>
                          <MessageSquare className="mr-1 h-3.5 w-3.5" />
                          Contact
                        </Button>
                        <Button size="sm" variant="outline" className={cn("h-8 rounded-lg text-xs", embedInDashboard && chrome?.quiet)}>
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
