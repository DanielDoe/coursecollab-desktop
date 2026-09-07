"use client"

import { QuizManagement } from "@/components/quiz-management"
import { useAssessment } from "@/context/assessment-context"

export default function AssessmentPage() {
  const { type } = useAssessment()

  return <QuizManagement assessmentType={type} />
}
