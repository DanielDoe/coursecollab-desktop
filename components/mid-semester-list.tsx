"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AssessmentActionButtons } from "@/components/assessment-action-buttons"
import { Clock, CheckCircle2, ShieldCheck } from "lucide-react"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { useNotification } from "@/components/notification-provider"
import { RetakeUpgradeModal } from "@/components/retake-upgrade-modal"

interface MidSemester {
  id: number
  title: string
  description: string
  coverage?: string
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
}

export function MidSemesterList() {
  const router = useRouter()
  const { toast } = useNotification()
  usePreventBack("/student/login")
  const [midSemesters, setMidSemesters] = useState<MidSemester[]>([])
  const [loading, setLoading] = useState(true)
  const [studentName, setStudentName] = useState("")
  const [studentSection, setStudentSection] = useState("")
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [retakeAccess, setRetakeAccess] = useState<{ hasAccess: boolean } | null>(null)

  useEffect(() => {
    const name = sessionStorage.getItem("studentName")
    const section = sessionStorage.getItem("studentSection")
    const studentId = sessionStorage.getItem("studentId")

    if (!studentId) {
      router.push("/student/login")
      return
    }

    setStudentName(name || "")
    setStudentSection(section || "")

    fetchMidSemesters(studentId)
    
    // Check retake access
    const studentDatabaseId = sessionStorage.getItem("studentDatabaseId")
    if (studentDatabaseId) {
      studentApiFetch(`/api/student/retake-access?studentId=${studentDatabaseId}`)
        .then(res => res.json())
        .then(data => setRetakeAccess(data))
        .catch(err => console.error("Failed to check retake access:", err))
    }
  }, [router])

  const fetchMidSemesters = async (studentId: string) => {
    try {
      const response = await studentApiFetch(`/api/student/mid-semesters?studentId=${studentId}`)
      const data = await response.json()
      setMidSemesters(data.midSemesters || [])
    } catch (error) {
      console.error("[v0] Failed to fetch mid-semester exams:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartExam = (examId: number) => {
    router.push(`/student/mid-semester-exams/take/${examId}`)
  }
  
  const handleRetakeClick = async (examId: number) => {
    // Check per-exam retake access
    try {
      let studentDatabaseId = sessionStorage.getItem("studentDatabaseId")
      
      // If missing, try to fetch from API instead of immediately redirecting
      if (!studentDatabaseId) {
        const studentId = sessionStorage.getItem("studentId")
        
        if (!studentId) {
          router.push("/student/login")
          return
        }

        try {
          // Fetch student info to get missing value
          const infoResponse = await studentApiFetch(`/api/student/info?student_id=${studentId}`)
          const infoData = await infoResponse.json()

          if (!infoResponse.ok) {
            throw new Error(infoData.error || "Failed to fetch student info")
          }

          // Update missing value
          if (infoData.student?.id) {
            studentDatabaseId = infoData.student.id.toString()
            sessionStorage.setItem("studentDatabaseId", studentDatabaseId)
          }

          // If still missing after fetch, then redirect
          if (!studentDatabaseId) {
            throw new Error("Could not retrieve session information")
          }
        } catch (error) {
          console.error("[v0] Failed to retrieve session data:", error)
          router.push("/student/login")
          return
        }
      }
      
      const response = await studentApiFetch(`/api/student/retake-access?studentId=${studentDatabaseId}&quizId=${examId}`)
      const data = await response.json()
      
      if (data.canRetake === true) {
        handleStartExam(examId)
        return
      }
      
      if (data.hasRetakeAccess === true) {
        toast({ title: "Maximum attempts reached", description: "You've used all attempts for this assessment.", variant: "default" })
        return
      }
      
      setShowUpgradeModal(true)
    } catch (error) {
      console.error("Failed to check retake access:", error)
      // On error, show upgrade modal to be safe
      setShowUpgradeModal(true)
    }
  }

  const handleViewReport = (attemptId: number) => {
    router.push(`/student/results/${attemptId}?type=mid_semester`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 sm:py-12 overflow-x-hidden">
        <div className="text-xs sm:text-sm text-muted-foreground">
          <span className="sm:hidden">Loading...</span>
          <span className="hidden sm:inline">Loading mid-semester exams...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 overflow-x-hidden">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1 sm:mb-2 break-words">
          <span className="sm:hidden">Welcome</span>
          <span className="hidden sm:inline">Welcome, {studentName}</span>
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground break-words">
          <span className="sm:hidden">Sec {studentSection}</span>
          <span className="hidden sm:inline">Section: {studentSection}</span>
        </p>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {midSemesters.length === 0 ? (
          <Card className="rounded-xl sm:rounded-2xl overflow-hidden">
            <CardContent className="py-8 sm:py-12 text-center p-4 sm:p-6">
              <Lock className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
              <p className="text-xs sm:text-sm text-muted-foreground break-words">
                <span className="sm:hidden">No exams available</span>
                <span className="hidden sm:inline">No mid-semester exams available at the moment.</span>
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 break-words">
                <span className="sm:hidden">Exams will appear when scheduled</span>
                <span className="hidden sm:inline">Mid-semester exams will appear here when they are scheduled and unlocked by your instructor.</span>
              </p>
            </CardContent>
          </Card>
        ) : (
          midSemesters.map((exam) => (
            <Card key={exam.id} className="border-2 rounded-xl sm:rounded-2xl overflow-hidden">
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <CardTitle className="text-base sm:text-lg md:text-xl break-words">{exam.title}</CardTitle>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs sm:text-sm shrink-0">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Official
                      </Badge>
                    </div>
                    <CardDescription className="mt-1 sm:mt-2 text-xs sm:text-sm break-words">{exam.description}</CardDescription>
                  </div>
                  {exam.attempted ? (
                    <Badge variant="outline" className="bg-success/10 text-success border-success text-xs sm:text-sm shrink-0 w-fit">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  ) : exam.is_active ? (
                    <Badge className="bg-primary text-xs sm:text-sm shrink-0 w-fit">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs sm:text-sm shrink-0 w-fit">
                      <Lock className="h-3 w-3 mr-1" />
                      Locked
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                    <span className="break-words">
                      <span className="sm:hidden">{Math.round(exam.time_per_question / 60)}m</span>
                      <span className="hidden sm:inline">{Math.round(exam.time_per_question / 60)} minutes total</span>
                    </span>
                  </div>
                  <div>
                    <span className="break-words">{exam.question_count} <span className="sm:hidden">Q</span><span className="hidden sm:inline">questions</span></span>
                  </div>
                  {exam.coverage && (
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs sm:text-sm">
                        📚 {exam.coverage}
                      </Badge>
                    </div>
                  )}
                </div>
                {exam.attempted && (
                  <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-muted rounded-lg sm:rounded-md">
                    <p className="text-xs sm:text-sm font-medium break-words">
                      Your Score: {exam.score}/{exam.total_questions} (
                      {Math.round((exam.score! / exam.total_questions!) * 100)}%)
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="p-4 sm:p-6 pt-0 flex justify-end">
                <AssessmentActionButtons
                  layout="horizontal"
                  align="right"
                  assessmentLabel="Exam"
                  startGradient="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  onViewReport={exam.attempt_id ? () => handleViewReport(exam.attempt_id!) : undefined}
                  onRetake={exam.attempted && exam.is_active ? () => handleRetakeClick(exam.id) : undefined}
                  onStart={exam.can_take && exam.is_active ? () => handleStartExam(exam.id) : undefined}
                  show={{
                    report: !!(exam.attempted && exam.attempt_id),
                    retake: !!(exam.attempted && exam.attempt_id && exam.is_active),
                    start: !(exam.attempted && exam.attempt_id) && !!(exam.can_take && exam.is_active),
                    locked: !(exam.attempted && exam.attempt_id) && !(exam.can_take && exam.is_active),
                  }}
                  fullWidthMobile
                />
              </CardFooter>
            </Card>
          ))
        )}
      </div>
      
      {/* Retake Upgrade Modal */}
      <RetakeUpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        assessmentType="Mid-Semester Exam"
      />
    </div>
  )
}
