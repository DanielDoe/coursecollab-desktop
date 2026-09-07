"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, TrendingUp, TrendingDown, Users, Target, Clock, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"
import { usePreventBack } from "@/hooks/use-prevent-back"

interface QuizAnalytics {
  quiz_id: number
  quiz_title: string
  total_attempts: number
  avg_score: number
  completion_rate: number
  avg_time_spent: number
}

interface QuestionAnalytics {
  question_id: number
  question_text: string
  quiz_title: string
  total_attempts: number
  correct_count: number
  incorrect_count: number
  accuracy_rate: number
  avg_time_spent: number
  difficulty_level: "Easy" | "Medium" | "Hard"
}

interface SessionAnalytics {
  session_code: string
  total_students: number
  total_attempts: number
  avg_score: number
  active_quizzes: number
}

export function AnalyticsDashboard() {
  const router = useRouter()
  usePreventBack("/admin/login")
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [selectedQuiz, setSelectedQuiz] = useState<string>("all")
  const [quizAnalytics, setQuizAnalytics] = useState<QuizAnalytics[]>([])
  const [questionAnalytics, setQuestionAnalytics] = useState<QuestionAnalytics[]>([])
  const [sessionAnalytics, setSessionAnalytics] = useState<SessionAnalytics[]>([])
  const [overallStats, setOverallStats] = useState({
    total_quizzes: 0,
    total_attempts: 0,
    avg_score: 0,
    total_students: 0,
  })

  useEffect(() => {
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      router.push("/admin/login")
      return
    }

    fetchAnalytics()
  }, [router, selectedQuiz])

  const fetchAnalytics = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedQuiz !== "all") {
        params.append("quiz_id", selectedQuiz)
      }

      const response = await fetch(`/api/admin/analytics?${params.toString()}`)
      const data = await response.json()

      setQuizAnalytics(data.quizAnalytics || [])
      setQuestionAnalytics(data.questionAnalytics || [])
      setSessionAnalytics(data.sessionAnalytics || [])
      setOverallStats(
        data.overallStats || {
          total_quizzes: 0,
          total_attempts: 0,
          avg_score: 0,
          total_students: 0,
        },
      )
    } catch (error) {
      console.error("[v0] Failed to fetch analytics:", error)
      toast({
        title: "Failed to load analytics",
        description: "An error occurred while loading analytics data.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "bg-green-100 text-green-700 border-green-300"
      case "Medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-300"
      case "Hard":
        return "bg-red-100 text-red-700 border-red-300"
      default:
        return "bg-gray-100 text-gray-700 border-gray-300"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Quiz performance and student insights</p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedQuiz} onValueChange={setSelectedQuiz}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select quiz" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Quizzes</SelectItem>
              {quizAnalytics.map((quiz) => (
                <SelectItem key={quiz.quiz_id} value={quiz.quiz_id.toString()}>
                  {quiz.quiz_title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link href="/admin/dashboard">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardDescription>Total Quizzes</CardDescription>
            <CardTitle className="text-3xl">{overallStats.total_quizzes}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>Active assessments</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardDescription>Total Attempts</CardDescription>
            <CardTitle className="text-3xl">{overallStats.total_attempts}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Student submissions</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardDescription>Average Score</CardDescription>
            <CardTitle className="text-3xl">{overallStats.avg_score.toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              {overallStats.avg_score >= 70 ? (
                <>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">Good performance</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-red-600">Needs improvement</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardDescription>Total Students</CardDescription>
            <CardTitle className="text-3xl">{overallStats.total_students}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Unique participants</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Session Analytics */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Session Performance</CardTitle>
          <CardDescription>Performance breakdown by session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sessionAnalytics.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No session data available yet.</p>
            ) : (
              sessionAnalytics.map((session) => (
                <div
                  key={session.session_code}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-base px-3 py-1">
                      {session.session_code}
                    </Badge>
                    <div className="space-y-1">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          <Users className="h-4 w-4 inline mr-1" />
                          {session.total_students} students
                        </span>
                        <span className="text-muted-foreground">
                          <Target className="h-4 w-4 inline mr-1" />
                          {session.total_attempts} attempts
                        </span>
                        <span className="text-muted-foreground">{session.active_quizzes} active quizzes</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-foreground">{session.avg_score.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">Avg Score</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quiz Analytics */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Quiz Performance</CardTitle>
          <CardDescription>Detailed performance metrics for each quiz</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {quizAnalytics.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No quiz data available yet.</p>
            ) : (
              quizAnalytics.map((quiz) => (
                <div key={quiz.quiz_id} className="p-4 rounded-lg border bg-card space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-foreground">{quiz.quiz_title}</h4>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>
                          <Users className="h-4 w-4 inline mr-1" />
                          {quiz.total_attempts} attempts
                        </span>
                        <span>
                          <Clock className="h-4 w-4 inline mr-1" />
                          {Math.round(quiz.avg_time_spent / 60)} min avg
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-foreground">{quiz.avg_score.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">Avg Score</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Completion Rate</span>
                        <span className="font-medium">{quiz.completion_rate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${quiz.completion_rate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Question Analytics */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Question Difficulty Analysis</CardTitle>
          <CardDescription>Performance breakdown by individual questions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {questionAnalytics.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No question data available yet.</p>
            ) : (
              questionAnalytics.map((question) => (
                <div key={question.question_id} className="p-4 rounded-lg border bg-card space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getDifficultyColor(question.difficulty_level)}>
                          {question.difficulty_level}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{question.quiz_title}</span>
                      </div>
                      <p className="text-foreground leading-relaxed">{question.question_text}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-foreground">{question.accuracy_rate.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">Accuracy</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-semibold">{question.correct_count}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">Correct</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
                        <XCircle className="h-4 w-4" />
                        <span className="font-semibold">{question.incorrect_count}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">Incorrect</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <Clock className="h-4 w-4" />
                        <span className="font-semibold">{Math.round(question.avg_time_spent)}s</span>
                      </div>
                      <div className="text-xs text-muted-foreground">Avg Time</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
