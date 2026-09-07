"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Clock,
  FileText,
  Lock,
  CheckCircle2,
  Award,
  TrendingUp,
  Target,
  Zap,
  BookOpen,
  Trophy,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AssessmentActionButtons } from "@/components/assessment-action-buttons"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { StudentHeader } from "@/components/student-header"
import { MidSemesterIssuesPanel } from "@/components/midsemester-issues-panel"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { useScrollRestoration } from "@/hooks/use-persisted-state"
import { logEvent, logError, logPerformance } from "@/lib/observability"
import { studentResultsPdfGateSatisfied } from "@/lib/student-results-pdf-gate"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"

interface MidSemester {
  id: number
  title: string
  description: string
  is_active: boolean
  time_per_question: number
  question_count: number
  attempted: boolean
  attempt_id?: number
  score?: number
  total_questions?: number
  completed?: boolean
  can_take?: boolean
  can_retake?: boolean
  attempts_remaining?: number
  available_from?: string
  available_until?: string
  coverage?: string
}

interface ExamReadiness {
  quizCompletion: number
  practiceAccuracy: number
  confidenceLevel: number
  practiceSessions: number
}

export default function StudentMidSemesterExamsPage() {
  const router = useRouter()
  usePreventBack("/student/login")
  
  // Restore scroll position
  useScrollRestoration("student-mid-semester")

  const [exams, setExams] = useState<MidSemester[]>([])
  const [readiness, setReadiness] = useState<ExamReadiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [studentName, setStudentName] = useState("")
  const [studentSection, setStudentSection] = useState("")
  const [countdown, setCountdown] = useState("")

  useEffect(() => {
    const name = sessionStorage.getItem("studentName")
    const section = sessionStorage.getItem("studentSection")
    const studentId = sessionStorage.getItem("studentId")
    const studentDatabaseId = sessionStorage.getItem("studentDatabaseId")

    if (!studentId && !studentDatabaseId) {
      router.push("/student/login")
      return
    }

    setStudentName(name || "")
    setStudentSection(section || "")

    fetchExamData(studentId, studentDatabaseId)
  }, [router])

  useEffect(() => {
    if (exams.length === 0) return

    const interval = setInterval(() => {
      // Check the first available exam for countdown
      const firstExam = exams.find(e => e.available_from)
      if (!firstExam?.available_from) {
        setCountdown("Exams Available")
        return
      }

      const now = new Date().getTime()
      const examStart = new Date(firstExam.available_from).getTime()
      const distance = examStart - now

      if (distance < 0) {
        setCountdown("Exams Active Now!")
        return
      }

      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)

      setCountdown(
        `Starts in ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [exams])

  const fetchExamData = async (studentId: string | null, studentDatabaseId: string | null) => {
    const startTime = Date.now()
    
    // Log page view
    logEvent("mid_semester", "page", "VIEW_EXAM_LIST", {
      studentId: studentId ?? studentDatabaseId
    }, "info")
    
    try {
      // Use quizzes API (same as v2) so classic and v2 get identical attempt_ids
      let studentParam = ""
      if (studentDatabaseId && Number(studentDatabaseId) > 0) {
        studentParam = `studentDatabaseId=${studentDatabaseId}`
      } else if (studentId) {
        // Try to fetch student info to get database ID (prefer for consistency with v2)
        try {
          const infoRes = await studentApiFetch(`/api/student/info?student_id=${studentId}`)
          const infoData = await infoRes.json()
          if (infoData.student?.id) {
            const dbId = infoData.student.id.toString()
            sessionStorage.setItem("studentDatabaseId", dbId)
            studentParam = `studentDatabaseId=${dbId}`
          }
        } catch {
          // fallback to studentId
        }
        if (!studentParam) studentParam = `studentId=${studentId}`
      }

      const examResponse = await studentApiFetch(`/api/student/quizzes?${studentParam}&type=mid_semester`)
      const examData = await examResponse.json()

      const quizzes = examData.quizzes ?? examData.assessments ?? []
      if (Array.isArray(quizzes) && quizzes.length > 0) {
        setExams(quizzes)
        logPerformance("mid_semester", "api", "FETCH_EXAMS_COMPLETE", startTime, {
          examCount: quizzes.length,
          availableExams: quizzes.filter((e: MidSemester) => e.can_take).length
        })
      }

      // Fetch readiness data (uses studentId for lookup)
      const readinessId = studentId ?? sessionStorage.getItem("studentId")
      if (readinessId) {
        const readinessResponse = await studentApiFetch(`/api/student/exam-readiness?studentId=${readinessId}`)
        const readinessData = await readinessResponse.json()
        setReadiness(readinessData)
      }
    } catch (error) {
      logError("mid_semester", "api", error instanceof Error ? error : new Error(String(error)), {
        studentId: studentId ?? studentDatabaseId,
        phase: "fetch_exam_list"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleStartExam = (examId: number) => {
    // Log exam start navigation
    const exam = exams.find(e => e.id === examId)
    logEvent("mid_semester", "navigation", "START_EXAM_CLICK", {
      examId,
      examTitle: exam?.title,
      questionCount: exam?.question_count,
      timePerQuestion: exam?.time_per_question
    }, "info")
    
    router.push(`/student/mid-semester-exams/take/${examId}`)
  }

  const handleViewReport = async (attemptId: number) => {
    // Log report view navigation
    logEvent("mid_semester", "navigation", "VIEW_REPORT_CLICK", {
      attemptId
    }, "info")
    
    // Check PDF download status before navigating
    try {
      const response = await studentApiFetch(`/api/student/results/${attemptId}`, {
        headers: getStudentAuthHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        const hasDownloaded = studentResultsPdfGateSatisfied(data)
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('🔍 [PDF Download] View Report Button Clicked (Mid-Semester)')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('📄 Attempt ID:', attemptId)
        console.log('📥 PDF Downloaded:', hasDownloaded ? '✅ YES' : '❌ NO')
        
        if (!hasDownloaded) {
          console.log('🚫 PDF not downloaded - storing navigation intent for immediate modal')
          sessionStorage.setItem('pendingReportNavigation', `/student/results/${attemptId}?type=mid_semester`)
          sessionStorage.setItem('pendingReportAttemptId', attemptId.toString())
        } else {
          console.log('✅ PDF already downloaded - allowing navigation')
        }
      }
    } catch (error) {
      console.error('[PDF Download] Error checking download status:', error)
      sessionStorage.setItem('pendingReportNavigation', `/student/results/${attemptId}?type=mid_semester`)
      sessionStorage.setItem('pendingReportAttemptId', attemptId.toString())
    }
    
    router.push(`/student/results/${attemptId}?type=mid_semester`)
  }

  const getConfidenceEmoji = (level: number) => {
    if (level >= 80) return "🔥"
    if (level >= 60) return "💪"
    if (level >= 40) return "📚"
    return "🎯"
  }

  const getConfidenceLabel = (level: number) => {
    if (level >= 80) return "Very Ready"
    if (level >= 60) return "Good Progress"
    if (level >= 40) return "Keep Studying"
    return "More Practice Needed"
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <StudentHeader />
        <div className="flex items-center justify-center py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-purple-600/30 dark:border-purple-500/30 border-t-purple-600 dark:border-t-purple-500 rounded-full animate-spin"></div>
            <div className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              <span className="sm:hidden">Loading...</span>
              <span className="hidden sm:inline">Loading exam hub...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-x-hidden">
      <StudentHeader />

      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl overflow-x-hidden">
        <motion.section
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-xl sm:rounded-2xl overflow-hidden bg-gradient-to-r from-purple-600 via-indigo-700 to-purple-900 dark:from-purple-700 dark:via-indigo-800 dark:to-purple-950 text-white shadow-lg p-4 sm:p-5 md:p-6 mb-6 sm:mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4 relative">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">
                <span className="sm:hidden">Mid-Semester</span>
                <span className="hidden sm:inline">Mid-Semester Exam Hub</span>
              </h1>
              <p className="text-xs sm:text-sm text-purple-200 dark:text-purple-300 mt-0.5 sm:mt-1">
                <span className="sm:hidden">Assessments</span>
                <span className="hidden sm:inline">Take exams, track progress, and view results</span>
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap">
              {countdown && exams.some(e => e.is_active) && (
                <Badge variant="secondary" className="bg-white/20 dark:bg-white/10 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm">
                  {countdown.includes("Starts") ? "⏳" : "🟢"} <span className="hidden sm:inline">{countdown}</span>
                </Badge>
              )}
              <Badge variant="secondary" className="bg-white/20 dark:bg-white/10 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm shrink-0">
                <span className="sm:hidden">Sec {studentSection}</span>
                <span className="hidden sm:inline">Section {studentSection}</span>
              </Badge>
              
              {/* Back Button - Floating to the right on mobile, full button on desktop */}
              <Button
                onClick={() => router.push("/student/dashboard")}
                variant="secondary"
                size="sm"
                className="absolute top-0 right-0 sm:relative sm:top-auto sm:right-auto rounded-lg sm:rounded-full bg-white/90 dark:bg-white/10 text-purple-700 dark:text-white hover:bg-white dark:hover:bg-white/20 font-medium text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            </div>
          </div>
        </motion.section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left: Exam List (2 columns) */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-2 lg:order-1">
            {exams.length === 0 ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className="relative bg-gradient-to-br from-slate-50/95 to-white/90 dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-lg border border-slate-200/60 dark:border-slate-700/60 shadow-xl p-6 sm:p-8 md:p-12 text-center rounded-xl sm:rounded-2xl">
                  <Lock className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 text-slate-400 dark:text-slate-500" />
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-700 dark:text-slate-200 mb-2">No Exams Scheduled</h2>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 break-words">
                    <span className="sm:hidden">Exams will appear when scheduled</span>
                    <span className="hidden sm:inline">Your mid-semester exams will appear here when they're scheduled by your instructor.</span>
                  </p>
                </Card>
              </motion.div>
            ) : (
              <>
                {/* Readiness Stats - Only show once */}
                {readiness && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6"
                >
                  {/* Quizzes Completed */}
                  <Card className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3 md:gap-4 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 shadow-sm hover:shadow-md transition-shadow border border-slate-200/50 dark:border-slate-700/50 rounded-xl sm:rounded-2xl">
                    <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        <span className="sm:hidden">Quizzes</span>
                        <span className="hidden sm:inline">Quizzes Completed</span>
                      </p>
                      <Progress value={readiness.quizCompletion} className="h-1.5 sm:h-2 mt-1" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">{readiness.quizCompletion}%</span>
                  </Card>

                  {/* Practice Accuracy */}
                  <Card className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3 md:gap-4 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-900/50 shadow-sm hover:shadow-md transition-shadow border border-blue-200/50 dark:border-blue-700/50 rounded-xl sm:rounded-2xl">
                    <Target className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        <span className="sm:hidden">Accuracy</span>
                        <span className="hidden sm:inline">Practice Accuracy</span>
                      </p>
                      <Progress value={readiness.practiceAccuracy} className="h-1.5 sm:h-2 mt-1" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-400 shrink-0">{readiness.practiceAccuracy}%</span>
                  </Card>

                  {/* Confidence Level */}
                  <Card className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3 md:gap-4 bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-900/50 shadow-sm hover:shadow-md transition-shadow border border-amber-200/50 dark:border-amber-700/50 rounded-xl sm:rounded-2xl sm:col-span-2 md:col-span-1">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        <span className="sm:hidden">Confidence</span>
                        <span className="hidden sm:inline">Confidence Level</span>
                      </p>
                      <Progress value={readiness.confidenceLevel} className="h-1.5 sm:h-2 mt-1" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-amber-700 dark:text-amber-400 shrink-0">
                      {getConfidenceEmoji(readiness.confidenceLevel)} <span className="hidden sm:inline">{getConfidenceLabel(readiness.confidenceLevel)}</span>
                    </span>
                  </Card>
                </motion.div>
              )}

                {/* Exam List */}
                <div className="space-y-3 sm:space-y-4">
                <h2 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3 sm:mb-4">
                  <span className="sm:hidden">Exams</span>
                  <span className="hidden sm:inline">Available Mid-Semester Exams</span>
                </h2>
                {exams.map((exam, index) => (
                  <motion.div
                    key={exam.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="relative bg-white dark:bg-slate-800/85 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow rounded-xl sm:rounded-2xl">
                      <div className="p-4 sm:p-5 md:p-6">
                        {/* Main Content */}
                        <div className="mb-3 sm:mb-4">
                          <div className="flex items-center gap-2 sm:gap-3 mb-2">
                            <div className="p-1.5 sm:p-2 bg-slate-100 dark:bg-slate-700 rounded-lg shrink-0">
                              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 dark:text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 break-words">{exam.title}</h3>
                              {exam.description && (
                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 break-words">{exam.description}</p>
                              )}
                            </div>
                          </div>

                          {/* Exam Details */}
                          <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6 text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-3 sm:mt-4">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                              <span>{Math.round(exam.time_per_question / 60)} min</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                              <span>{exam.question_count} <span className="sm:hidden">Q</span><span className="hidden sm:inline">questions</span></span>
                            </div>
                            {exam.coverage && (
                              <div className="flex items-center gap-1">
                                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                                <span className="truncate max-w-[120px] sm:max-w-none">{exam.coverage || 'Ch. 1–5'}</span>
                              </div>
                            )}
                          </div>

                          {/* Status and Score */}
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 mt-3 sm:mt-4">
                            {exam.is_active ? (
                              <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700 text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-600 text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1">
                                <Lock className="h-3 w-3 mr-1" /> Locked
                              </Badge>
                            )}
                            
                            {exam.completed && exam.score !== undefined && (
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700 text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1">
                                  <Trophy className="h-3 w-3 mr-1" />
                                  {Math.round((exam.score / exam.total_questions!) * 100)}%
                                </Badge>
                                <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                                  {exam.attempts_used} <span className="sm:hidden">att</span><span className="hidden sm:inline">attempt{exam.attempts_used !== 1 ? 's' : ''} used</span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end w-full sm:w-auto sm:justify-end">
                          <AssessmentActionButtons
                            layout="horizontal"
                            compact
                            assessmentLabel="Exam"
                            startGradient="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                            onViewReport={exam.attempt_id ? () => handleViewReport(exam.attempt_id!) : undefined}
                            onRetake={exam.completed && exam.attempt_id && exam.can_retake && exam.is_active ? () => handleStartExam(exam.id) : undefined}
                            onStart={exam.is_active && !exam.completed ? () => handleStartExam(exam.id) : undefined}
                            show={{
                              report: !!(exam.completed && exam.attempt_id),
                              retake: !!(exam.completed && exam.attempt_id && exam.can_retake && exam.is_active),
                              start: !!(!exam.completed && exam.is_active),
                              locked: !exam.is_active,
                            }}
                            fullWidthMobile
                          />
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>

                {/* Study Tip */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <Card className="bg-gradient-to-r from-slate-50 via-blue-50 to-emerald-50 dark:from-slate-800/50 dark:via-blue-900/20 dark:to-emerald-900/20 border border-slate-200/60 dark:border-slate-700/60 shadow-md text-center p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl">
                    <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm break-words">
                      📚 <strong>Study Smart:</strong> <span className="sm:hidden">Review notes and practice quizzes. You've got this!</span>
                      <span className="hidden sm:inline">Review your notes, complete practice quizzes, and join review sessions. Every effort adds up. You've got this!</span>
                    </p>
                  </Card>
                </motion.div>
              </>
            )}
          </div>

          {/* Right: Issues Panel - Always visible */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <MidSemesterIssuesPanel />
          </div>
        </div>
      </main>
    </div>
  )
}