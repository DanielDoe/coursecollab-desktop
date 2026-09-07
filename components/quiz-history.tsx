"use client"

import { useEffect, useState, memo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { dbTimeToCDT } from "@/lib/timezone"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import {
  Trophy,
  Eye,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Minus,
  History,
  BookOpen,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { getStudentData } from "@/lib/auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface QuizAttempt {
  attempt_id: number
  attempt_number: number
  score: number
  total_questions: number
  percentage: number
  started_at: string
  completed_at: string
  is_final_grade: boolean
}

interface QuizHistoryItem {
  quiz_id: number
  quiz_title: string
  retake_enabled: boolean
  retake_limit: number | null
  retake_policy: string
  attempts: QuizAttempt[]
}

interface QuizHistoryData {
  quizHistory: QuizHistoryItem[]
}

export function QuizHistory({ view = "list", embedInDashboard = false }: { view?: "grid" | "list"; embedInDashboard?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expandedQuizzes, setExpandedQuizzes] = useState<Set<number>>(new Set())
  const [internalView, setInternalView] = useState<"grid" | "list">(view)
  const viewMode = embedInDashboard ? internalView : view
  const setViewMode = embedInDashboard ? setInternalView : () => {}

  useEffect(() => {
    const load = () => {
      const studentData = getStudentData()
      if (!studentData?.databaseId) {
        router.push("/student/login")
        return
      }
      fetchQuizHistory(studentData.databaseId)
    }
    load()

    // Refetch when page gains focus — ensures students see instructor grade updates
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    const onVisibilityChange = () => document.visibilityState === "visible" && load()
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [router])

  const fetchQuizHistory = async (studentId: string) => {
    try {
      const response = await studentApiFetch(`/api/student/quiz-history?studentId=${studentId}`, {
        cache: "no-store",
        headers: { ...getStudentAuthHeaders(), "Cache-Control": "no-cache" },
      })
      const data: QuizHistoryData = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to load history")
        setLoading(false)
        return
      }

      setQuizHistory(data.quizHistory)
    } catch (error) {
      console.error("[v0] Failed to fetch quiz history:", error)
      setError("Failed to load history. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const toggleQuizExpansion = (quizId: number) => {
    setExpandedQuizzes((prev) => {
      const newSet = new Set(prev)
      newSet.has(quizId) ? newSet.delete(quizId) : newSet.add(quizId)
      return newSet
    })
  }

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return "text-emerald-600 dark:text-emerald-400"
    if (percentage >= 80) return "text-blue-600 dark:text-blue-400"
    if (percentage >= 70) return "text-amber-600 dark:text-amber-400"
    return "text-red-600 dark:text-red-400"
  }

  const getPercentageBgColor = (percentage: number) => {
    if (percentage >= 90) return "bg-emerald-50/80 dark:bg-emerald-900/30 border-emerald-200/60 dark:border-emerald-700/60"
    if (percentage >= 80) return "bg-blue-50/80 dark:bg-blue-900/30 border-blue-200/60 dark:border-blue-700/60"
    if (percentage >= 70) return "bg-amber-50/80 dark:bg-amber-900/30 border-amber-200/60 dark:border-amber-700/60"
    return "bg-red-50/80 dark:bg-red-900/30 border-red-200/60 dark:border-red-700/60"
  }

  const getTrendIcon = (attempts: QuizAttempt[]) => {
    if (attempts.length < 2) return <Minus className="h-4 w-4 text-slate-400 dark:text-slate-500" />
    const [latest, previous] = [attempts[0].percentage, attempts[1].percentage]
    if (latest > previous) return <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
    if (latest < previous) return <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
    return <Minus className="h-4 w-4 text-slate-400 dark:text-slate-500" />
  }

  const formatDate = (dateString: string | Date) => {
    return dbTimeToCDT(dateString)
  }

  const getFinalGrade = (quiz: QuizHistoryItem) => {
    const finalAttempt = quiz.attempts.find((a) => a.is_final_grade)
    return finalAttempt ? finalAttempt.percentage : quiz.attempts[0]?.percentage || 0
  }

  if (loading) return <QuizHistorySkeleton embedInDashboard={embedInDashboard} />

  if (error)
    return (
      <Alert variant="destructive" className="rounded-2xl">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )

  if (quizHistory.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
        <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-700/80 mb-4">
          <History className="h-12 w-12 sm:h-16 sm:w-16 text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">No History Yet</h3>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-6 max-w-sm px-4">
          You haven&apos;t completed any assessments yet. Quizzes, homework, mid-semester, and finals will appear here.
        </p>
        <Link href={embedInDashboard ? "/student/dashboard-v2/quizzes" : "/student/quizzes"}>
          <Button className="gap-2 rounded-2xl bg-gradient-to-r from-primary via-purple-500 to-primary hover:from-primary/90 hover:via-purple-500/90 hover:to-primary/90 text-white font-semibold shadow-lg min-h-[44px] touch-manipulation">
            <BookOpen className="h-4 w-4" />
            Browse Quizzes
          </Button>
        </Link>
      </div>
    )

  const totalAttempts = quizHistory.reduce((sum, quiz) => sum + quiz.attempts.length, 0)
  const avgScore = Math.round(
    quizHistory.reduce((sum, quiz) => sum + getFinalGrade(quiz), 0) / quizHistory.length
  )

  return (
    <div className="space-y-6">
      {/* Header + View Toggle (only when embedInDashboard) */}
      {embedInDashboard && (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            History
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Quizzes, homework, mid-semester, and finals — your attempts and updated grades
          </p>
        </div>
        <div className={cn(
          "flex items-center gap-1.5 shrink-0 p-1 rounded-2xl",
          "bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10"
        )}>
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="icon"
            onClick={() => setViewMode("grid")}
            className={cn(
              "h-9 w-9 sm:h-10 sm:w-10 rounded-2xl transition-all touch-manipulation",
              embedInDashboard
                ? viewMode === "grid"
                  ? "bg-white dark:bg-white/10 text-primary shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                : viewMode === "grid"
                  ? "bg-primary text-white"
                  : "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="icon"
            onClick={() => setViewMode("list")}
            className={cn(
              "h-9 w-9 sm:h-10 sm:w-10 rounded-2xl transition-all touch-manipulation",
              embedInDashboard
                ? viewMode === "list"
                  ? "bg-white dark:bg-white/10 text-primary shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                : viewMode === "list"
                  ? "bg-primary text-white"
                  : "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <List className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          {
            label: "Assessments",
            icon: Trophy,
            color: "text-purple-600 dark:text-purple-400",
            bg: "bg-purple-100/80 dark:bg-purple-900/80",
            value: quizHistory.length,
          },
          {
            label: "Total Attempts",
            icon: RotateCcw,
            color: "text-blue-600 dark:text-blue-400",
            bg: "bg-blue-100/80 dark:bg-blue-900/80",
            value: totalAttempts,
          },
          {
            label: "Average Score",
            icon: TrendingUp,
            color: "text-emerald-600 dark:text-emerald-400",
            bg: "bg-emerald-100/80 dark:bg-emerald-900/80",
            value: avgScore + "%",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border min-w-0",
              embedInDashboard
                ? "bg-slate-50/50 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10"
                : "bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60"
            )}
          >
            <div className={cn("h-10 w-10 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center shrink-0", stat.bg)}>
              <stat.icon className={cn("h-5 w-5 sm:h-6 sm:w-6", stat.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">{stat.label}</p>
              <p className="text-xl sm:text-2xl font-semibold mt-0.5 text-slate-800 dark:text-slate-200 tabular-nums">
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Assessment History */}
      <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5" : "space-y-4"}>
        {quizHistory.map((quiz) => (
          <QuizHistoryCard
            key={quiz.quiz_id}
            quiz={quiz}
            isExpanded={expandedQuizzes.has(quiz.quiz_id)}
            onToggle={() => toggleQuizExpansion(quiz.quiz_id)}
            onViewResults={(attemptId) => router.push(`/student/results/${attemptId}`)}
            getFinalGrade={getFinalGrade}
            getPercentageColor={getPercentageColor}
            getPercentageBgColor={getPercentageBgColor}
            getTrendIcon={getTrendIcon}
            formatDate={formatDate}
            view={viewMode}
            embedInDashboard={embedInDashboard}
          />
        ))}
      </div>
    </div>
  )
}

// Skeleton Loader Component
function QuizHistorySkeleton({ embedInDashboard }: { embedInDashboard?: boolean }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-20 rounded-2xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "flex items-center gap-4 p-4 rounded-2xl",
              embedInDashboard ? "bg-slate-50/50 dark:bg-white/[0.03]" : "bg-white/80 dark:bg-slate-800/80"
            )}
          >
            <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="rounded-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-5">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <Skeleton className="h-24 w-full rounded-xl" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Memoized Quiz Card Component - Modern design with left accent bar
const QuizHistoryCard = memo(({
  quiz,
  isExpanded,
  onToggle,
  onViewResults,
  getFinalGrade,
  getPercentageColor,
  getPercentageBgColor,
  getTrendIcon,
  formatDate,
  view = "list",
  embedInDashboard = false,
}: {
  quiz: QuizHistoryItem
  isExpanded: boolean
  onToggle: () => void
  onViewResults: (attemptId: number) => void
  getFinalGrade: (quiz: QuizHistoryItem) => number
  getPercentageColor: (percentage: number) => string
  getPercentageBgColor: (percentage: number) => string
  getTrendIcon: (attempts: QuizAttempt[]) => React.ReactNode
  formatDate: (date: string | Date) => string
  view?: "grid" | "list"
  embedInDashboard?: boolean
}) => {
  const latestAttempt = quiz.attempts[0]
  const finalGrade = getFinalGrade(quiz)

  const cardClasses = cn(
    "group relative overflow-hidden rounded-2xl border transition-all duration-300 min-w-0",
    "bg-white dark:bg-slate-800/90",
    "border-slate-200/80 dark:border-slate-700/60",
    "hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
    "hover:border-slate-300/80 dark:hover:border-slate-600/80",
    embedInDashboard && "dark:bg-white/[0.04] dark:border-white/10 dark:hover:border-primary/30"
  )

  return (
    <div className={cardClasses}>
      {/* Left accent bar - color by score */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-gradient-to-b",
          latestAttempt.percentage >= 90 ? "from-emerald-500 to-emerald-600" :
          latestAttempt.percentage >= 80 ? "from-blue-500 to-blue-600" :
          latestAttempt.percentage >= 70 ? "from-primary to-purple-600" :
          "from-amber-500 to-orange-500"
        )}
      />

      <div className="pl-4 sm:pl-5">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 sm:pt-5 pb-3 pr-4 sm:pr-5">
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white break-words">
              {quiz.quiz_title}
            </h3>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <RotateCcw className="h-3.5 w-3.5" />
                {quiz.attempts.length} attempt{quiz.attempts.length !== 1 ? "s" : ""}
              </span>
              {quiz.retake_enabled && (
                <Badge variant="secondary" className="rounded-lg text-[11px] sm:text-xs px-2 py-0 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-0">
                  Retakes: {quiz.retake_limit ?? "∞"}
                </Badge>
              )}
              <Badge variant="outline" className="rounded-lg text-[11px] sm:text-xs px-2 py-0 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400">
                {quiz.retake_policy}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {getTrendIcon(quiz.attempts)}
            <div className={cn(
              "text-2xl sm:text-3xl font-bold tabular-nums",
              getPercentageColor(finalGrade)
            )}>
              {Math.round(finalGrade)}%
            </div>
          </div>
        </div>

        {/* Latest attempt - compact pill */}
        <div className={cn(
          "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 rounded-xl border mb-4 mx-4 sm:mx-5",
          getPercentageBgColor(latestAttempt.percentage)
        )}>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Latest</span>
              <Badge className="rounded-lg text-xs px-2 py-0 bg-slate-200/80 dark:bg-slate-600/80 text-slate-700 dark:text-slate-200">
                #{latestAttempt.attempt_number}
              </Badge>
            </div>
            <div className="flex items-center gap-4 sm:gap-6 text-sm">
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-xs block">Score</span>
                <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                  {latestAttempt.score}/{latestAttempt.total_questions}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 text-xs block">Completed</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                  {formatDate(latestAttempt.completed_at)}
                </span>
              </div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => onViewResults(latestAttempt.attempt_id)}
            className="self-start sm:self-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white font-medium min-h-[40px] touch-manipulation w-full sm:w-auto"
          >
            <Eye className="h-4 w-4" />
            View Results
          </Button>
        </div>

        {/* Toggle + expanded attempts */}
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="w-full rounded-2xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 min-h-[40px] touch-manipulation"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Hide all {quiz.attempts.length} attempt{quiz.attempts.length !== 1 ? "s" : ""}
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                View all {quiz.attempts.length} attempt{quiz.attempts.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>

          {isExpanded && (
            <div className="mt-4 space-y-2">
              {quiz.attempts.map((attempt) => (
                <div
                  key={attempt.attempt_id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                      Attempt #{attempt.attempt_number}
                    </span>
                    <div className="text-sm min-w-0">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {attempt.score}/{attempt.total_questions}
                      </span>
                      <span className={cn("ml-1.5 font-semibold", getPercentageColor(attempt.percentage))}>
                        ({Math.round(attempt.percentage)}%)
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatDate(attempt.completed_at)}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onViewResults(attempt.attempt_id)}
                    className="gap-2 rounded-2xl border-primary/30 dark:border-primary/50 text-primary dark:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 shrink-0 min-h-[40px] touch-manipulation w-full sm:w-auto"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

QuizHistoryCard.displayName = "QuizHistoryCard"
