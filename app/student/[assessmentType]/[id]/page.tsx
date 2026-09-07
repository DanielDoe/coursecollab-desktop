"use client"

import { QuizTaker } from "@/components/quiz-taker"
import { AssessmentTakerShell } from "@/components/student/assessment-taker-shell"
import { use } from "react"

export default function TakeAssessmentPage({
  params,
}: {
  params: Promise<{ assessmentType: string; id: string }>
}) {
  const { id, assessmentType } = use(params)
  return (
    <AssessmentTakerShell>
      <QuizTaker quizId={id} assessmentType={assessmentType} />
    </AssessmentTakerShell>
  )
}
