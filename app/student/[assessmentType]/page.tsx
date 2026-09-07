"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAssessment } from "@/context/assessment-context"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { StudentHeader } from "@/components/student-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Clock, Target } from "lucide-react"

export default function StudentAssessmentPage({
  params,
}: {
  params: Promise<{ assessmentType: string }>
}) {
  const router = useRouter()
  const { assessmentType } = use(params)
  const { type, label } = useAssessment()
  const [loading, setLoading] = useState(true)
  const [assessments, setAssessments] = useState<any[]>([])
  const [studentId, setStudentId] = useState<number | null>(null)

  useEffect(() => {
    if (!assessmentType) return
    // Guard: Redirect routes that shouldn't be handled as assessment types
    const nonAssessmentRoutes = [
      'calendar', 'dashboard', 'profile', 'notifications', 'help', 
      'change-password', 'forum', 'groups', 'projects', 'lectures',
      'announcements', 'ai-tutor', 'codebench', 'playground', 'membership'
    ]
    
    if (nonAssessmentRoutes.includes(assessmentType)) {
      router.push(`/student/${assessmentType}`)
      return
    }

    const studentData = getStudentData()
    if (!studentData || !studentData.databaseId) {
      router.push("/student/login")
      return
    }

    setStudentId(Number.parseInt(studentData.databaseId))

    if (type === "practice") {
      // Redirect to practice hub for practice type
      router.push("/student/practice")
    } else {
      fetchAssessments(Number.parseInt(studentData.databaseId))
    }
  }, [router, type, assessmentType])

  const fetchAssessments = async (studentDbId: number) => {
    try {
      const response = await studentApiFetch(`/api/student/quizzes?studentId=${studentDbId}&type=${encodeURIComponent(type)}`)
      const data = await response.json()
      if (response.ok) {
        setAssessments(data.quizzes || [])
      }
    } catch (error) {
      console.error("[v0] Failed to fetch assessments:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-secondary dark:bg-slate-900 overflow-x-hidden">
        <StudentHeader />
        <main className="container mx-auto px-3 sm:px-4 md:px-6 py-8 sm:py-12 text-center text-muted-foreground dark:text-slate-300 overflow-x-hidden">
          <p className="text-sm sm:text-base">
            <span className="sm:hidden">Loading...</span>
            <span className="hidden sm:inline">Loading {label.toLowerCase()}...</span>
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary dark:bg-slate-900 overflow-x-hidden">
      <StudentHeader />
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-6xl overflow-x-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight break-words text-foreground dark:text-slate-100">{label}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground dark:text-slate-400 mt-0.5 sm:mt-1 break-words">
              <span className="sm:hidden">View {label.toLowerCase()}</span>
              <span className="hidden sm:inline">View and take your {label.toLowerCase()}</span>
            </p>
          </div>
          <Button 
            onClick={() => router.push("/student/dashboard")} 
            variant="outline" 
            size="sm"
            className="gap-1.5 sm:gap-2 rounded-lg sm:rounded-full text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
        </div>

        {assessments.length === 0 ? (
          <Card className="rounded-xl sm:rounded-2xl overflow-hidden border-slate-200 dark:border-slate-700 bg-card dark:bg-slate-800">
            <CardContent className="py-8 sm:py-12 text-center p-4 sm:p-6">
              <p className="text-xs sm:text-sm text-muted-foreground break-words">
                No {label.toLowerCase()} available at this time.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4">
            {assessments.map((assessment) => (
              <Card key={assessment.id} className="rounded-xl sm:rounded-2xl overflow-hidden border-slate-200 dark:border-slate-700 bg-card dark:bg-slate-800">
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base sm:text-lg break-words">{assessment.title}</CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                          <span className="break-words">{assessment.time_per_question}s per question</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                          <span className="break-words">{assessment.question_count} questions</span>
                        </span>
                      </CardDescription>
                    </div>
                    <Badge 
                      variant={assessment.is_active ? "default" : "secondary"}
                      className="text-xs sm:text-sm shrink-0 w-fit"
                    >
                      {assessment.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <Button
                    onClick={() => router.push(`/student/${type}/${assessment.id}`)}
                    disabled={!assessment.is_active}
                    className="w-full rounded-lg sm:rounded-xl text-xs sm:text-sm h-10 sm:h-11 min-h-[44px] sm:min-h-0"
                  >
                    Start {label}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
