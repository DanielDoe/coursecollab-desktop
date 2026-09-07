"use client"

import { use } from "react"
import { useSearchParams } from "next/navigation"
import { QuizResults } from "@/components/quiz-results"
import { StudentHeader } from "@/components/student-header"

export default function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const type = searchParams.get("type") ?? undefined
  const assessmentType =
    type === "mid_semester" || type === "final" || type === "homework" || type === "quiz"
      ? type
      : "quiz"

  return (
    <div className="min-h-screen bg-[var(--cc-background)]">
      <StudentHeader />
      <main className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <QuizResults attemptId={id} assessmentType={assessmentType} preferDashboardV2 />
      </main>
    </div>
  )
}
