"use client"

import { useParams, useSearchParams } from "next/navigation"
import { QuizResults } from "@/components/quiz-results"
import { StudentHeader } from "@/components/student-header"

export default function ResultsPage() {
  const params = useParams<{ id?: string | string[] }>()
  const searchParams = useSearchParams()
  const rawId = params?.id
  const id = Array.isArray(rawId) ? rawId[0] ?? "" : rawId ?? ""
  const type = searchParams?.get("type") ?? ""
  const assessmentType =
    type === "mid_semester" || type === "final" || type === "homework" || type === "quiz" ? type : "quiz"

  return (
    <div className="min-h-screen bg-[var(--cc-background)]">
      <StudentHeader />
      <main className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <QuizResults attemptId={id} assessmentType={assessmentType} preferDashboardV2 />
      </main>
    </div>
  )
}
