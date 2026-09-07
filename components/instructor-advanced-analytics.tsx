"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import { buildInstructorAuthorizedApiHeaders } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { InstructorAnalyticsPerformanceView } from "@/components/instructor/analytics-performance-view"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { getFacultyModuleTheme } from "@/lib/faculty-module-themes"
import { cn } from "@/lib/utils"
import {
  AN_META,
  AN_PANEL,
  AN_SPINNER,
  PORTAL_TEXT_MUTED,
} from "@/lib/analytics/analytics-instructor-ui"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  BookOpen,
  AlertTriangle,
  Clock,
  CheckCircle,
  Download,
  RefreshCw,
  Calendar,
  PieChart,
  LineChart,
  Activity,
  Brain,
  Zap,
  Eye,
  FileText,
  UserCheck,
  Star,
  Trophy,
  Lightbulb,
  Settings,
  Filter,
  ArrowUp,
  ArrowDown,
  Minus,
  ArrowLeft
} from "lucide-react"
import {
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts"

interface AdvancedAnalyticsData {
  success: boolean
  period: string
  assessmentType: string
  dateRange: {
    start: string
    end: string
  }
  overview: {
    total_students: number
    total_assessments: number
    total_attempts: number
    average_score: number
    completed_attempts: number
    incomplete_attempts: number
  }
  assessmentTypePerformance: Array<{
    type: string
    attempts: number
    unique_students: number
    avg_score: number
    min_score: number
    max_score: number
    total_assessments: number
  }>
  sessionPerformance: Array<{
    session_code: string
    session_name: string
    attempts: number
    unique_students: number
    avg_score: number
    total_assessments: number
  }>
  topicPerformance: Array<{
    topic: string
    attempts: number
    unique_students: number
    avg_score: number
    total_assessments: number
  }>
  questionTypePerformance: Array<{
    question_type: string
    attempts: number
    unique_students: number
    avg_score: number
    total_assessments: number
  }>
  difficultyAnalysis: Array<{
    difficulty: string
    attempts: number
    unique_students: number
    avg_score: number
    total_assessments: number
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
  dailyTrends: Array<{
    date: string
    attempts: number
    unique_students: number
    avg_score: number
  }>
  topStudents: Array<{
    id: number
    first_name: string
    last_name: string
    session_code: string
    total_attempts: number
    avg_score: number
    highest_score: number
    assessments_taken: number
  }>
  strugglingStudents: Array<{
    id: number
    first_name: string
    last_name: string
    session_code: string
    total_attempts: number
    avg_score: number
    lowest_score: number
    assessments_taken: number
  }>
  assessmentDetails: Array<{
    id: number
    title: string
    assessment_type: string
    attempts: number
    unique_students: number
    avg_score: number
    min_score: number
    max_score: number
    completed: number
    incomplete: number
  }>
  completionRates: Array<{
    assessment_type: string
    total_attempts: number
    completed_attempts: number
    completion_rate: number
  }>
  aiTutorStats: {
    total_conversations: number
    unique_students: number
    avg_rating: number
  }
  practiceStats: {
    total_attempts: number
    unique_students: number
    avg_score: number
    passed_attempts: number
  }
}

export function InstructorAdvancedAnalytics({
  embedInDashboard,
  embedInHub,
  activeTab: controlledTab,
  onActiveTabChange,
  hideSideMenu,
}: {
  embedInDashboard?: boolean
  embedInHub?: boolean
  activeTab?: string
  onActiveTabChange?: (tab: string) => void
  hideSideMenu?: boolean
} = {}) {
  const fp = embedInHub ? facultyEmbedChrome("advanced-analytics").p : getFacultyModuleTheme("advanced-analytics").page

  const [data, setData] = useState<AdvancedAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState("30d")
  const [selectedAssessmentType, setSelectedAssessmentType] = useState("all")
  const [internalTab, setInternalTab] = useState("overview")
  const activeTab = controlledTab ?? internalTab
  const setActiveTab = onActiveTabChange ?? setInternalTab
  const [searchQuery, setSearchQuery] = useState("")
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()

  useEffect(() => {
    fetchAnalytics()
  }, [selectedPeriod, selectedAssessmentType, courseScopeVersion])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/instructor/advanced-analytics?period=${selectedPeriod}&assessmentType=${selectedAssessmentType}`,
        { headers: buildInstructorAuthorizedApiHeaders() },
      )

      if (response.ok) {
        const analyticsData = await response.json()
        if (analyticsData?.success) {
          setData(analyticsData as AdvancedAnalyticsData)
        } else {
          throw new Error(analyticsData?.error || "Analytics response was not successful")
        }
      } else {
        let errorData
        const responseText = await response.text()
        console.error("Response status:", response.status)
        console.error("Response statusText:", response.statusText)
        console.error("Response body (raw):", responseText)
        
        try {
          errorData = JSON.parse(responseText)
        } catch (parseError) {
          errorData = { error: "Failed to parse error response", status: response.status, body: responseText }
        }
        console.error("API Error (parsed):", errorData)
        
        toast({
          title: "❌ Failed to Load Analytics",
          description: errorData.details || errorData.error || `Server error: ${response.status}. Check console for details.`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching analytics:", error)
      toast({
        title: "❌ Failed to Load Analytics",
        description: error instanceof Error ? error.message : "Could not retrieve analytics data. Please check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const exportAnalytics = () => {
    if (!data) return
    
    const csvContent = [
      "Metric,Value",
      `Total Students,${data.overview.total_students}`,
      `Total Assessments,${data.overview.total_assessments}`,
      `Total Attempts,${data.overview.total_attempts}`,
      `Average Score,${formatNumber(data.overview.average_score)}%`,
      `Completed Attempts,${data.overview.completed_attempts}`,
      `Incomplete Attempts,${data.overview.incomplete_attempts}`,
      `Completion Rate,${formatNumber((data.overview.completed_attempts / data.overview.total_attempts) * 100)}%`
    ].join("\n")
    
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `advanced-analytics-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    
    toast({
      title: "✅ Analytics Exported",
      description: "Advanced analytics data has been exported to CSV file.",
    })
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400"
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400"
    return "text-red-600 dark:text-red-400"
  }

  const getAssessmentTypeColor = (type: string) => {
    switch (type) {
      case "quiz": return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200 dark:border-blue-500/30"
      case "mid_semester": return "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-200 dark:border-purple-500/30"
      case "final": return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 border-red-200 dark:border-red-500/30"
      case "homework": return "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300 border-green-200 dark:border-green-500/30"
      case "practice": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/30"
      default: return "bg-gray-100 text-gray-700 dark:bg-slate-500/20 dark:text-slate-300 border-gray-200 dark:border-slate-500/30"
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300 border-green-200 dark:border-green-500/30"
      case "medium": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/30"
      case "hard": return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 border-red-200 dark:border-red-500/30"
      default: return "bg-gray-100 text-gray-700 dark:bg-slate-500/20 dark:text-slate-300 border-gray-200 dark:border-slate-500/30"
    }
  }

  const formatNumber = (value: unknown, decimals: number = 1): string => {
    const num = typeof value === "string" ? parseFloat(value) : Number(value)
    return Number.isFinite(num) ? num.toFixed(decimals) : "0"
  }

  const chartDailyTrends = data
    ? [...data.dailyTrends].sort((a, b) => String(a.date).localeCompare(String(b.date)))
    : []

  const AnalyticsSectionEmpty = ({ message }: { message: string }) => (
    <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">{message}</p>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className={cn("h-8 w-8 mx-auto mb-4", AN_SPINNER)} />
          <p className={PORTAL_TEXT_MUTED}>Loading advanced analytics…</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <BarChart3 className={`w-16 h-16 mx-auto mb-4 ${embedInDashboard ? cn(fp.iconText, "opacity-50") : "text-slate-400"}`} />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-200 mb-2">
          No Analytics Data Available
        </h3>
        <p className="text-slate-600 dark:text-slate-400">
          Advanced analytics data will appear here once students start taking assessments.
        </p>
        <Button onClick={fetchAnalytics} className={cn("mt-4 rounded-lg", fp.cta)}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  const cardBase = cn(AN_PANEL, "rounded-xl")
  const cardHeaderBase = cn("flex items-center gap-2", "text-[var(--cc-text)]")
  const cardIconBase = cn("p-2 rounded-lg shrink-0", fp.iconBg)
  const cardIcon = cn("h-4 w-4", fp.iconText)

  const toolbar = (
    <FacultyIntegratedToolbar
      moduleId="advanced-analytics"
      search={searchQuery}
      onSearchChange={setSearchQuery}
      onSearchClear={() => setSearchQuery("")}
      searchPlaceholder="Search students, assessments, sessions…"
      filters={
        <>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className={cn(facultyToolbarFilterButtonClass(), "h-9 w-[132px] shadow-none")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedAssessmentType} onValueChange={setSelectedAssessmentType}>
            <SelectTrigger
              className={cn(
                facultyToolbarFilterButtonClass(selectedAssessmentType !== "all"),
                "h-9 w-[148px] shadow-none",
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="quiz">Quizzes</SelectItem>
              <SelectItem value="mid_semester">Mid-Semester</SelectItem>
              <SelectItem value="final">Finals</SelectItem>
              <SelectItem value="homework">Homework</SelectItem>
              <SelectItem value="practice">Practice</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
      meta={
        <p className={AN_META}>
          {selectedPeriod.replace("d", " days").replace("1y", "Last year")} ·{" "}
          {selectedAssessmentType === "all" ? "All assessment types" : selectedAssessmentType.replace("_", " ")}
        </p>
      }
      trailing={
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={fetchAnalytics}
            className={facultyToolbarFilterButtonClass()}
          >
            <RefreshCw className="h-3.5 w-3.5 opacity-70" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={exportAnalytics}
            className={facultyToolbarFilterButtonClass()}
          >
            <Download className="h-3.5 w-3.5 opacity-70" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </>
      }
    />
  )

  const tabContent = (
        <div className="flex-1 min-w-0 overflow-x-hidden">
        {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Completion Rate */}
          <Card className={cardBase}>
            <CardHeader className="pb-4">
              <CardTitle className={cardHeaderBase}>
                <div className={cardIconBase}>
                  <CheckCircle className={cardIcon} />
                </div>
                Completion rate
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                By assessment type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.completionRates.length === 0 ? (
                  <AnalyticsSectionEmpty message="No completion data for this period. Try a longer date range or a different assessment type." />
                ) : (
                data.completionRates.map((rate) => (
                  <div key={rate.assessment_type} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge className={`${getAssessmentTypeColor(rate.assessment_type)} shrink-0`}>
                        {rate.assessment_type.replace('_', ' ')}
                      </Badge>
                      <span className="text-sm text-slate-600 dark:text-slate-400">{rate.total_attempts} attempts</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Progress value={rate.completion_rate} className="h-2 w-24 sm:w-32 bg-slate-200 dark:bg-white/10" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 w-12 text-right">{formatNumber(rate.completion_rate)}%</span>
                    </div>
                  </div>
                ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Assessment Type Performance */}
          <Card className={cardBase}>
            <CardHeader className="pb-4">
              <CardTitle className={cardHeaderBase}>
                <div className={cardIconBase}>
                  <BarChart3 className={cardIcon} />
                </div>
                By assessment type
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Performance across categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.assessmentTypePerformance.length === 0 ? (
                  <AnalyticsSectionEmpty message="No assessment attempts in this period." />
                ) : (
                data.assessmentTypePerformance.map((type) => (
                  <div key={type.type} className="p-4 rounded-lg border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <Badge className={`${getAssessmentTypeColor(type.type)} text-xs`}>
                        {type.type.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{type.attempts} attempts</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Students</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{type.unique_students}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">Avg score</span>
                        <span className={`font-semibold ${getScoreColor(type.avg_score)}`}>{formatNumber(type.avg_score)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Range</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{type.min_score}% – {type.max_score}%</span>
                      </div>
                    </div>
                  </div>
                ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Session Performance */}
          <Card className={cardBase}>
            <CardHeader className="pb-4">
              <CardTitle className={cardHeaderBase}>
                <div className={cardIconBase}>
                  <Users className={cardIcon} />
                </div>
                By session
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Performance by session
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.sessionPerformance.length === 0 ? (
                  <AnalyticsSectionEmpty message="No session activity in this period." />
                ) : (
                data.sessionPerformance.map((session) => (
                  <div key={session.session_code} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0 w-10 h-10 rounded-lg bg-teal-500/10 dark:bg-teal-500/20 flex items-center justify-center">
                        <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">{session.session_code}</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-slate-800 dark:text-slate-200 truncate">{session.session_name}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{session.attempts} attempts</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Students</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{session.unique_students}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Avg score</p>
                        <span className={`font-semibold ${getScoreColor(session.avg_score)}`}>{formatNumber(session.avg_score)}%</span>
                      </div>
                    </div>
                  </div>
                ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {activeTab === "performance" && (
          <InstructorAnalyticsPerformanceView
            data={data}
            cardBase={cardBase}
            cardHeaderBase={cardHeaderBase}
            cardIconBase={cardIconBase}
            cardIcon={cardIcon}
            getDifficultyColor={getDifficultyColor}
            getScoreColor={getScoreColor}
            emptyMessage={
              <AnalyticsSectionEmpty message="No assessment attempts in this period. Try a longer date range or switch to All Types." />
            }
          />
        )}

        {activeTab === "students" && (
        <div className="space-y-6">
          <Card className={cardBase}>
            <CardHeader className="pb-4">
              <CardTitle className={cardHeaderBase}>
                <div className={cardIconBase}>
                  <Trophy className={cardIcon} />
                </div>
                Top performers
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Highest-scoring students
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.topStudents.length === 0 ? (
                  <AnalyticsSectionEmpty message="No graded attempts to rank students in this period." />
                ) : (
                data.topStudents.map((student, index) => (
                  <div key={student.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-200/60 dark:border-white/[0.06] bg-green-50/50 dark:bg-green-500/5 border-green-200/50 dark:border-green-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-500/20 dark:bg-teal-500/30 flex items-center justify-center font-bold text-teal-700 dark:text-teal-300 text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-slate-800 dark:text-slate-200">{student.first_name} {student.last_name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{student.session_code}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="text-right"><p className="text-xs text-slate-500 dark:text-slate-400">Attempts</p><p className="font-medium">{student.total_attempts}</p></div>
                      <div className="text-right"><p className="text-xs text-slate-500 dark:text-slate-400">Avg</p><span className={`font-semibold ${getScoreColor(student.avg_score)}`}>{formatNumber(student.avg_score)}%</span></div>
                      <div className="text-right"><p className="text-xs text-slate-500 dark:text-slate-400">Highest</p><span className="font-semibold text-green-600 dark:text-green-400">{student.highest_score}%</span></div>
                    </div>
                  </div>
                ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={cardBase}>
            <CardHeader className="pb-4">
              <CardTitle className={cardHeaderBase}>
                <div className={cardIconBase}>
                  <AlertTriangle className={cardIcon} />
                </div>
                Needing support
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Students who may need extra help
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.strugglingStudents.length === 0 ? (
                  <AnalyticsSectionEmpty message="No students below 60% average in this period — or no attempts yet." />
                ) : (
                data.strugglingStudents.map((student, index) => (
                  <div key={student.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-200/60 dark:border-white/[0.06] bg-red-50/50 dark:bg-red-500/5 border-red-200/50 dark:border-red-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200/80 dark:bg-white/10 flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-slate-800 dark:text-slate-200">{student.first_name} {student.last_name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{student.session_code}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="text-right"><p className="text-xs text-slate-500 dark:text-slate-400">Attempts</p><p className="font-medium">{student.total_attempts}</p></div>
                      <div className="text-right"><p className="text-xs text-slate-500 dark:text-slate-400">Avg</p><span className={`font-semibold ${getScoreColor(student.avg_score)}`}>{formatNumber(student.avg_score)}%</span></div>
                      <div className="text-right"><p className="text-xs text-slate-500 dark:text-slate-400">Lowest</p><span className="font-semibold text-red-600 dark:text-red-400">{student.lowest_score}%</span></div>
                    </div>
                  </div>
                ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {activeTab === "assessments" && (
        <div className="space-y-6">
          <Card className={cardBase}>
            <CardHeader className="pb-4">
              <CardTitle className={cardHeaderBase}>
                <div className={cardIconBase}>
                  <BookOpen className={cardIcon} />
                </div>
                Assessment details
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Per-assessment performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.assessmentDetails.length === 0 ? (
                  <AnalyticsSectionEmpty message="No assessment attempts in this period." />
                ) : (
                data.assessmentDetails.map((assessment) => (
                  <div key={assessment.id} className="p-4 rounded-lg border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <Badge className={getAssessmentTypeColor(assessment.assessment_type)}>{assessment.assessment_type.replace('_', ' ')}</Badge>
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{assessment.title}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div><p className="text-slate-500 dark:text-slate-400">Attempts</p><p className="font-semibold text-slate-800 dark:text-slate-200">{assessment.attempts}</p></div>
                      <div><p className="text-slate-500 dark:text-slate-400">Students</p><p className="font-semibold text-slate-800 dark:text-slate-200">{assessment.unique_students}</p></div>
                      <div><p className="text-slate-500 dark:text-slate-400">Avg score</p><span className={`font-semibold ${getScoreColor(assessment.avg_score)}`}>{formatNumber(assessment.avg_score)}%</span></div>
                      <div><p className="text-slate-500 dark:text-slate-400">Range</p><p className="font-semibold text-slate-800 dark:text-slate-200">{assessment.min_score}% – {assessment.max_score}%</p></div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-200/60 dark:border-white/[0.06]">
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" />{assessment.completed} completed</span>
                        <span className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{assessment.incomplete} incomplete</span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Completion: {formatNumber((assessment.completed / assessment.attempts) * 100)}%</span>
                    </div>
                  </div>
                ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {activeTab === "trends" && (
        <div className="space-y-6">
          <Card className={cardBase}>
            <CardHeader className="pb-4">
              <CardTitle className={cardHeaderBase}>
                <div className={cardIconBase}>
                  <LineChart className={cardIcon} />
                </div>
                Daily trends
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Performance and attempts over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartDailyTrends.length === 0 ? (
                <AnalyticsSectionEmpty message="No daily activity in this period. Try expanding the date range." />
              ) : (
              <div className="h-72 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={chartDailyTrends}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" />
                    <XAxis dataKey="date" className="text-xs" stroke="currentColor" />
                    <YAxis className="text-xs" stroke="currentColor" />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)" }} />
                    <Legend />
                    <Line type="monotone" dataKey="avg_score" stroke="#0d9488" strokeWidth={2} name="Avg score (%)" />
                    <Line type="monotone" dataKey="attempts" stroke="#14b8a6" strokeWidth={2} name="Attempts" />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
              )}
            </CardContent>
          </Card>
        </div>
        )}

        {activeTab === "ai-tutor" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className={cardBase}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Brain className={cardIcon} />
                  AI conversations
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{data.aiTutorStats.total_conversations}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total conversations</p>
              </CardContent>
            </Card>
            <Card className={cardBase}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Users className={cardIcon} />
                  Active students
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{data.aiTutorStats.unique_students}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Using AI tutor</p>
              </CardContent>
            </Card>
            <Card className={cardBase}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Star className={cardIcon} />
                  Avg rating
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{formatNumber(data.aiTutorStats.avg_rating)}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Out of 5</p>
              </CardContent>
            </Card>
          </div>

          <Card className={cardBase}>
            <CardHeader className="pb-4">
              <CardTitle className={cardHeaderBase}>
                <div className={cardIconBase}>
                  <Zap className={cardIcon} />
                </div>
                Practice hub
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Practice analytics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Attempts</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-1">{data.practiceStats.total_attempts}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Students</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-1">{data.practiceStats.unique_students}</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Avg score</p>
                  <p className="text-xl font-bold text-teal-600 dark:text-teal-400 mt-1">{formatNumber(data.practiceStats.avg_score)}%</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Passed</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-1">{data.practiceStats.passed_attempts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        )}
        </div>
  )

  if (hideSideMenu) {
    return (
      <div className="space-y-4">
        {toolbar}
        {tabContent}
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {embedInHub ? toolbar : null}
      <FacultyModuleSplitLayout
        menu={
          <FacultyModuleSideMenu
            moduleId="advanced-analytics"
            title="Analytics"
            activeId={activeTab}
            onSelect={setActiveTab}
            items={[
              { id: "overview", label: "Overview", icon: BarChart3 },
              { id: "performance", label: "Performance", icon: TrendingUp },
              { id: "students", label: "Students", icon: Users },
              { id: "assessments", label: "Assessments", icon: BookOpen },
              { id: "trends", label: "Trends", icon: LineChart },
              { id: "ai-tutor", label: "AI Tutor", icon: Brain },
            ]}
          />
        }
      >
        {!embedInHub ? toolbar : null}
        {tabContent}
      </FacultyModuleSplitLayout>
    </div>
  )
}
