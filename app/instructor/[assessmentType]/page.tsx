"use client"

import { use, useEffect } from "react"
import { useRouter } from "next/navigation"

const REDIRECT_MAP: Record<string, string> = {
  quizzes: "/instructor/dashboard-v2/assessments/quizzes",
  homeworks: "/instructor/dashboard-v2/assessments/homework",
  "mid-semester-exams": "/instructor/dashboard-v2/assessments/mid-semester",
  "final-exams": "/instructor/dashboard-v2/assessments/finals",
}

interface InstructorAssessmentPageProps {
  params: Promise<{
    assessmentType: string
  }>
}

export default function InstructorAssessmentPage({ params }: InstructorAssessmentPageProps) {
  const { assessmentType } = use(params)
  const router = useRouter()

  useEffect(() => {
    router.replace(REDIRECT_MAP[assessmentType] ?? "/instructor/dashboard-v2/assessments/quizzes")
  }, [assessmentType, router])

  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--cc-accent)] border-t-transparent" />
    </div>
  )
}
