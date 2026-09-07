"use client"

import { QuizPreview } from "@/components/quiz-preview"
import { use } from "react"

interface PreviewAssessmentPageProps {
  params: Promise<{
    assessmentType: string
    id: string
  }>
}

export default function PreviewAssessmentPage({ params }: PreviewAssessmentPageProps) {
  const { id, assessmentType } = use(params)
  const normalizedType = assessmentType === "final-exams" ? "final" : assessmentType === "mid-semester-exams" ? "mid_semester" : assessmentType
  
  return <QuizPreview quizId={id} assessmentType={normalizedType} />
}

