"use client"

import { use } from "react"
import { AssessmentProvider } from "@/context/assessment-context"
import { QuizPreview } from "@/components/quiz-preview"

interface PreviewQuizPageProps {
  params: Promise<{ id: string }>
}

export default function PreviewQuizPage({ params }: PreviewQuizPageProps) {
  const { id } = use(params)

  return (
    <AssessmentProvider type="quiz">
      <QuizPreview quizId={id} assessmentType="quiz" embedInDashboard />
    </AssessmentProvider>
  )
}
