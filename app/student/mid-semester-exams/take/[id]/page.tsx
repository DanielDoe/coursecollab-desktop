"use client"

import { QuizTaker } from "@/components/quiz-taker"
import { AssessmentTakerShell } from "@/components/student/assessment-taker-shell"
import { use } from "react"

export default function TakeMidSemesterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <AssessmentTakerShell>
      <QuizTaker quizId={id} assessmentType="mid_semester" />
    </AssessmentTakerShell>
  )
}
