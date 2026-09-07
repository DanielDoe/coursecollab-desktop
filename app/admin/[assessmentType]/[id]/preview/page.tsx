"use client"

import { QuizPreview } from "@/components/quiz-preview"
import { useParams } from "next/navigation"

export default function PreviewAssessmentPage() {
  const params = useParams()
  const quizId = params.id as string

  return <QuizPreview quizId={quizId} />
}
