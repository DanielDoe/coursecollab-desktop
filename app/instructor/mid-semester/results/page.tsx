"use client"


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
  Users, 
  Trophy,
  Clock,
  AlertTriangle,
  BarChart3,
  Filter,
  GraduationCap,
  CheckCircle
} from "lucide-react"
import { dbTimeToCDT } from "@/lib/timezone"
import { useToast } from "@/components/ui/use-toast"

interface ExamResult {
  attemptId: number
  studentId: number
  studentName: string
  studentNumber: string
  studentEmail: string
  section: string
  examId: number
  examTitle: string
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
  gradeDistribution: {
    A: number
    B: number
    C: number
    D: number
    F: number
  }
}

export default function MidSemesterResultsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [results, setResults] = useState<ExamResult[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<any[]>([])
  const [exams, setExams] = useState<any[]>([])
  const [selectedSession, setSelectedSession] = useState("all")
  const [selectedExam, setSelectedExam] = useState("all")
  const [autoFinalizing, setAutoFinalizing] = useState(false)

  useEffect(() => {
    fetchSessions()
    fetchExams()
  }, [])

  useEffect(() => {
    fetchResults()
  }, [selectedSession, selectedExam])

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

  const fetchExams = async () => {
    try {
      // Request only mid-semester assessments to populate selector correctly
      const response = await instructorApiFetch("/api/instructor/quizzes?assessment_type=mid_semester", {
        headers: {
          'Authorization': localStorage.getItem("instructorSession") || "",
          'x-instructor-id': localStorage.getItem("instructorId") || ""
        }
      })
      if (response.ok) {
        const data = await response.json()
        // API already filters by assessment_type, no need to filter again
        const list = data.quizzes || []
        console.log('[MidSemesterResults] Fetched exams:', list)
        setExams(list)
      }
    } catch (error) {
      console.error("Error fetching exams:", error)
    }
  }

  const fetchResults = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        ...(selectedSession !== "all" && { sessionId: selectedSession }),
        ...(selectedExam !== "all" && { examId: selectedExam })
      })

      const response = await instructorApiFetch(`/api/instructor/midsemester-results?${params}`, {
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
          description: "Failed to fetch exam results",
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

    // Helper function to escape CSV fields (handles commas, quotes, newlines)
    const escapeCSV = (field: any) => {
      if (field === null || field === undefined) return ""
      const str = String(field)
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Enhanced headers with more details
    const headers = [
      "Student Name",
      "Student ID", 
      "Email",
      "Section", 
      "Exam", 
      "Score",
      "Total Points",
      "Percentage", 
      "Letter Grade",
      "Started At",
      "Completed At", 
      "Time (minutes)", 
      "Flagged",
      "Tab Switches",
      "Copy/Paste Attempts",
      "Mouse Leaves"
    ]

    const rows = results.map(r => [
      escapeCSV(r.studentName),
      escapeCSV(r.studentNumber),
      escapeCSV(r.studentEmail),
      escapeCSV(r.section),
      escapeCSV(r.examTitle),
      r.score.toFixed(2),
      r.totalPoints,
      r.percentage,
      getLetterGrade(r.percentage),
      dbTimeToCDT(r.startedAt),
      r.completedAt ? dbTimeToCDT(r.completedAt) : "In Progress",
      Math.round(r.timeTakenSeconds / 60),
      r.isFlagged ? "Yes" : "No",
      r.tabSwitchCount || 0,
      r.copyPasteAttempts || 0,
      r.mouseLeaveCount || 0
    ])

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    
    // Build filename with filter information
    const date = new Date().toISOString().split('T')[0]
    const sessionPart = selectedSession !== "all" 
      ? `-${sessions.find(s => s.id.toString() === selectedSession)?.code || 'session'}`
      : ""
    const examPart = selectedExam !== "all"
      ? `-${exams.find(e => e.id.toString() === selectedExam)?.title.replace(/[^a-zA-Z0-9]/g, '-') || 'exam'}`
      : ""
    
    a.download = `midsemester-results${sessionPart}${examPart}-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "✅ Export Successful",
      description: `Exported ${results.length} result(s) to CSV with applied filters`
    })
  }

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
    if (percentage >= 80) return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
    if (percentage >= 70) return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"
    if (percentage >= 60) return "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20"
    return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
  }

  const handleAutoFinalize = async () => {
    if (!selectedExam || selectedExam === "all") {
      toast({
        title: "Select an Exam",
        description: "Please select a specific exam to auto-finalize grades",
        variant: "destructive"
      })
      return
    }

    setAutoFinalizing(true)
    try {
      const response = await instructorApiFetch('/api/instructor/auto-finalize-attempts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem("instructorSession") || "",
          'x-instructor-id': localStorage.getItem("instructorId") || ""
        },
        body: JSON.stringify({
          quizId: parseInt(selectedExam),
          gradingPolicy: 'highest' // Default to highest score for mid-semester
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "✅ Auto-Finalize Complete",
          description: `Successfully finalized ${data.finalizedCount} student attempts using highest score policy`,
        })
        // Refresh results
        await fetchResults()
      } else {
        toast({
          title: "❌ Auto-Finalize Failed",
          description: data.error || "Failed to auto-finalize attempts",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Auto-finalize error:', error)
      toast({
        title: "❌ Auto-Finalize Failed",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setAutoFinalizing(false)
    }
  }

  const getLetterGrade = (percentage: number) => {
    if (percentage >= 90) return "A"
    if (percentage >= 80) return "B"
    if (percentage >= 70) return "C"
    if (percentage >= 60) return "D"
    return "F"
  }

  if (loading && results.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px] sm:min-h-[500px] overflow-x-hidden">
        <div className="text-center space-y-3 sm:space-y-4 px-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">
            <span className="sm:hidden">Loading...</span>
            <span className="hidden sm:inline">Loading exam results...</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/instructor/mid-semester")}
            className="gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to Mid-Semester</span>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2 break-words">
              <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 shrink-0" />
              <span className="sm:hidden">Results</span>
              <span className="hidden sm:inline">Mid-Semester Exam Results</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words mt-0.5 sm:mt-1">
              <span className="sm:hidden">Performance analysis</span>
              <span className="hidden sm:inline">Comprehensive exam performance analysis</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <Button 
            onClick={handleAutoFinalize} 
            disabled={autoFinalizing || selectedExam === "all"}
            size="sm"
            className="gap-1.5 sm:gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto min-h-[44px] sm:min-h-0"
            title="Auto-finalize all student attempts using highest score policy"
          >
            <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="sm:hidden">Finalize</span>
            <span className="hidden sm:inline">{autoFinalizing ? "Finalizing..." : "Auto-Finalize Grades"}</span>
          </Button>
          <Button onClick={exportToCSV} size="sm" className="gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto min-h-[44px] sm:min-h-0">
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="sm:hidden">Export</span>
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="rounded-xl sm:rounded-2xl overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            <span className="break-words">Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-xs sm:text-sm font-medium break-words">Session</label>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl">
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

            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-xs sm:text-sm font-medium break-words">Exam</label>
              <Select value={selectedExam} onValueChange={setSelectedExam}>
                <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl">
                  <SelectValue placeholder="All Exams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Mid-Semester Exams</SelectItem>
                  {exams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id.toString()}>
                      {exam.title}
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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="rounded-xl sm:rounded-2xl overflow-hidden">
              <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">Total Attempts</p>
                    <p className="text-xl sm:text-2xl font-bold break-words">{stats.totalAttempts}</p>
                  </div>
                  <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 shrink-0 ml-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl sm:rounded-2xl overflow-hidden">
              <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">Average Score</p>
                    <p className="text-xl sm:text-2xl font-bold break-words">{stats.averageScore}%</p>
                  </div>
                  <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 shrink-0 ml-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl sm:rounded-2xl overflow-hidden">
              <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">Highest Score</p>
                    <p className="text-xl sm:text-2xl font-bold break-words">{stats.highestScore}%</p>
                  </div>
                  <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500 shrink-0 ml-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl sm:rounded-2xl overflow-hidden">
              <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">Flagged</p>
                    <p className="text-xl sm:text-2xl font-bold break-words">{stats.flaggedAttempts}</p>
                  </div>
                  <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 shrink-0 ml-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Grade Distribution */}
          <Card className="rounded-xl sm:rounded-2xl overflow-hidden">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg break-words">Grade Distribution</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
                {Object.entries(stats.gradeDistribution).map(([grade, count]) => (
                  <div key={grade} className="text-center p-3 sm:p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-xl sm:text-2xl font-bold break-words">{count}</p>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">Grade {grade}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Results Table */}
      <Card className="min-w-0 max-w-full rounded-xl sm:rounded-2xl overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg break-words">Exam Results ({results.length})</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 max-w-full p-4 sm:p-6 pt-0">
          {results.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <GraduationCap className="h-10 w-10 sm:h-12 sm:w-12 text-slate-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">No results found</p>
            </div>
          ) : (
            <div className="min-w-0 w-full max-w-full overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">Student</TableHead>
                    <TableHead className="text-xs sm:text-sm">Section</TableHead>
                    <TableHead className="text-xs sm:text-sm">Exam</TableHead>
                    <TableHead className="text-xs sm:text-sm">Score</TableHead>
                    <TableHead className="text-xs sm:text-sm">Percentage</TableHead>
                    <TableHead className="text-xs sm:text-sm">Letter Grade</TableHead>
                    <TableHead className="text-xs sm:text-sm">Completed</TableHead>
                    <TableHead className="text-xs sm:text-sm">Time</TableHead>
                    <TableHead className="text-xs sm:text-sm">Status</TableHead>
                    <TableHead className="text-xs sm:text-sm">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.attemptId}>
                      <TableCell className="text-xs sm:text-sm">
                        <div className="min-w-0">
                          <p className="font-medium break-words">{result.studentName}</p>
                          <p className="text-xs text-slate-500 break-words">{result.studentNumber}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm break-words">{result.section}</TableCell>
                      <TableCell className="font-medium text-xs sm:text-sm break-words">{result.examTitle}</TableCell>
                      <TableCell className="text-xs sm:text-sm break-words">
                        {result.score.toFixed(2)}/{result.totalPoints}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getGradeColor(result.percentage)} text-xs sm:text-sm`}>
                          {result.percentage}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-bold text-xs sm:text-sm">
                          {getLetterGrade(result.percentage)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        <div className="break-words">
                          {result.completedAt ? dbTimeToCDT(result.completedAt) : "In Progress"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 shrink-0" />
                          <span className="break-words">{Math.round(result.timeTakenSeconds / 60)}m</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {result.isFlagged ? (
                          <Badge variant="destructive" className="gap-1 text-xs sm:text-sm">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span className="break-words">Flagged</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs sm:text-sm">Normal</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/instructor/results/${result.attemptId}`)}
                          className="gap-1 text-xs sm:text-sm h-8 sm:h-9 min-h-[32px] sm:min-h-0"
                        >
                          <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span className="sm:hidden">View</span>
                          <span className="hidden sm:inline">View</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

