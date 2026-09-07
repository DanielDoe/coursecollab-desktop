"use client"



import { studentApiFetch } from "@/lib/auth"
import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  ArrowLeft, 
  Download, 
  Eye, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Trophy,
  Clock,
  AlertTriangle,
  BarChart3,
  Filter,
  PlusCircle
} from "lucide-react"
import { AttemptOverrideDialog } from "@/components/attempt-override-dialog"
import { dbTimeToCDT } from "@/lib/timezone"
import { useToast } from "@/components/ui/use-toast"

interface QuizResult {
  attemptId: number
  studentId: number
  studentName: string
  studentNumber: string
  studentEmail: string
  section: string
  quizId: number
  quizTitle: string
  totalPoints: number
  score: number
  percentage: number
  startedAt: string
  completedAt: string
  timeTakenSeconds: number
  isFlagged: boolean
  tabSwitchCount: number
  copyPasteAttempts: number
  mouseLeaveCount: number
}

interface Stats {
  totalAttempts: number
  averageScore: number
  highestScore: number
  lowestScore: number
  flaggedAttempts: number
  completionRate: number
}

export default function QuizResultsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [results, setResults] = useState<QuizResult[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<any[]>([])
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [selectedSession, setSelectedSession] = useState("all")
  const [selectedQuiz, setSelectedQuiz] = useState("all")
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<{
    quizId: string
    studentId: string
    studentName: string
    studentCode: string
    currentAttempts: number
    maxAttempts: number
  } | null>(null)
  const [overrides, setOverrides] = useState<Map<string, any>>(new Map())

  useEffect(() => {
    fetchSessions()
    fetchQuizzes()
  }, [])

  useEffect(() => {
    fetchResults()
    if (selectedQuiz !== "all") {
      fetchOverrides(selectedQuiz)
    }
  }, [selectedSession, selectedQuiz])

  const fetchOverrides = async (quizId: string) => {
    try {
      const response = await instructorApiFetch(`/api/instructor/attempt-overrides?quizId=${quizId}`, {
        headers: {
          'x-instructor-id': localStorage.getItem("instructorId") || ""
        }
      })
      if (response.ok) {
        const data = await response.json()
        const overrideMap = new Map()
        data.overrides?.forEach((override: any) => {
          overrideMap.set(`${override.quiz_id}-${override.student_id}`, override)
        })
        setOverrides(overrideMap)
      }
    } catch (error) {
      console.error("Error fetching overrides:", error)
    }
  }

  const handleGrantOverride = (result: QuizResult) => {
    // Get student's membership tier to determine max attempts
    studentApiFetch(`/api/student/membership?studentId=${result.studentId}`)
      .then(res => res.json())
      .then(data => {
        const maxAttempts = data.limits?.quizzes || 1
        // Count attempts for this quiz
        const quizAttempts = results.filter(r => r.quizId === result.quizId && r.studentId === result.studentId).length
        setSelectedStudent({
          quizId: result.quizId.toString(),
          studentId: result.studentId.toString(),
          studentName: result.studentName,
          studentCode: result.studentNumber,
          currentAttempts: quizAttempts,
          maxAttempts: maxAttempts
        })
        setOverrideDialogOpen(true)
      })
      .catch(err => {
        console.error("Error fetching student membership:", err)
        // Default to Scholar tier (1 attempt)
        const quizAttempts = results.filter(r => r.quizId === result.quizId && r.studentId === result.studentId).length
        setSelectedStudent({
          quizId: result.quizId.toString(),
          studentId: result.studentId.toString(),
          studentName: result.studentName,
          studentCode: result.studentNumber,
          currentAttempts: quizAttempts,
          maxAttempts: 1
        })
        setOverrideDialogOpen(true)
      })
  }

  const fetchSessions = async () => {
    try {
      const response = await fetch("/api/admin/sessions", {
        headers: {
          'Authorization': localStorage.getItem("instructorSession") || "",
          'x-instructor-id': localStorage.getItem("instructorId") || ""
        }
      })
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
      }
    } catch (error) {
      console.error("Error fetching sessions:", error)
    }
  }

  const fetchQuizzes = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/quizzes?assessment_type=quiz", {
        headers: {
          'Authorization': localStorage.getItem("instructorSession") || "",
          'x-instructor-id': localStorage.getItem("instructorId") || ""
        }
      })
      if (response.ok) {
        const data = await response.json()
        setQuizzes(data.quizzes || [])
      }
    } catch (error) {
      console.error("Error fetching quizzes:", error)
    }
  }

  const fetchResults = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        ...(selectedSession !== "all" && { sessionId: selectedSession }),
        ...(selectedQuiz !== "all" && { quizId: selectedQuiz }),
        assessmentType: "quiz"
      })

      const response = await instructorApiFetch(`/api/instructor/quiz-results?${params}`, {
        headers: {
          'Authorization': localStorage.getItem("instructorSession") || "",
          'x-instructor-id': localStorage.getItem("instructorId") || ""
        }
      })

      if (response.ok) {
        const data = await response.json()
        setResults(data.results || [])
        setStats(data.stats || null)
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch quiz results",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error fetching results:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (results.length === 0) {
      toast({
        title: "No Data",
        description: "No results to export",
        variant: "destructive"
      })
      return
    }

    const headers = ["Student Name", "Student ID", "Section", "Quiz", "Score", "Percentage", "Completed At", "Time (min)", "Flagged"]
    const rows = results.map(r => [
      r.studentName,
      r.studentNumber,
      r.section,
      r.quizTitle,
      `${r.score}/${r.totalPoints}`,
      `${r.percentage}%`,
      dbTimeToCDT(r.completedAt),
      Math.round(r.timeTakenSeconds / 60),
      r.isFlagged ? "Yes" : "No"
    ])

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `quiz-results-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Success",
      description: "Results exported to CSV"
    })
  }

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
    if (percentage >= 80) return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
    if (percentage >= 70) return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"
    if (percentage >= 60) return "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20"
    return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
  }

  if (loading && results.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-600 dark:text-slate-400">Loading quiz results...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 p-4 sm:p-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push("/instructor/quizzes")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Quizzes
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Quiz Results</h1>
            <p className="text-slate-600 dark:text-slate-400">View and analyze quiz performance</p>
          </div>
        </div>
        <Button onClick={exportToCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Session</label>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger>
                  <SelectValue placeholder="All Sessions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id.toString()}>
                      {session.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Quiz</label>
              <Select value={selectedQuiz} onValueChange={setSelectedQuiz}>
                <SelectTrigger>
                  <SelectValue placeholder="All Quizzes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quizzes</SelectItem>
                  {quizzes.map((quiz) => (
                    <SelectItem key={quiz.id} value={quiz.id.toString()}>
                      {quiz.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Attempts</p>
                  <p className="text-2xl font-bold">{stats.totalAttempts}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Average Score</p>
                  <p className="text-2xl font-bold">{stats.averageScore}%</p>
                </div>
                <BarChart3 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Highest Score</p>
                  <p className="text-2xl font-bold">{stats.highestScore}%</p>
                </div>
                <Trophy className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Flagged</p>
                  <p className="text-2xl font-bold">{stats.flaggedAttempts}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Table */}
      <Card className="min-w-0 max-w-full overflow-hidden">
        <CardHeader>
          <CardTitle>Results ({results.length})</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 max-w-full">
          {results.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">No results found</p>
            </div>
          ) : (
            <div className="min-w-0 w-full max-w-full overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Quiz</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.attemptId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{result.studentName}</p>
                          <p className="text-sm text-slate-500">{result.studentNumber}</p>
                        </div>
                      </TableCell>
                      <TableCell>{result.section}</TableCell>
                      <TableCell>{result.quizTitle}</TableCell>
                      <TableCell>
                        {result.score}/{result.totalPoints}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={getGradeColor(result.percentage)}>
                            {result.percentage}%
                          </Badge>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            {result.percentage >= 90
                              ? "A"
                              : result.percentage >= 80
                                ? "B"
                                : result.percentage >= 70
                                  ? "C"
                                  : result.percentage >= 60
                                    ? "D"
                                    : "F"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {result.completedAt ? dbTimeToCDT(result.completedAt) : "In Progress"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-slate-400" />
                          {Math.round(result.timeTakenSeconds / 60)}m
                        </div>
                      </TableCell>
                      <TableCell>
                        {result.isFlagged ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Flagged
                          </Badge>
                        ) : (
                          <Badge variant="outline">Normal</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/instructor/results/${result.attemptId}`)}
                            className="gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGrantOverride(result)}
                            className="gap-1"
                            title="Grant extra attempts"
                          >
                            <PlusCircle className="h-4 w-4" />
                            Override
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Override Dialog */}
      {selectedStudent && (
        <AttemptOverrideDialog
          open={overrideDialogOpen}
          onOpenChange={setOverrideDialogOpen}
          quizId={selectedStudent.quizId}
          studentId={selectedStudent.studentId}
          studentName={selectedStudent.studentName}
          studentCode={selectedStudent.studentCode}
          currentAttempts={selectedStudent.currentAttempts}
          maxAttempts={selectedStudent.maxAttempts}
          onSuccess={() => {
            if (selectedQuiz !== "all") {
              fetchOverrides(selectedQuiz)
            }
          }}
        />
      )}
    </div>
  )
}

