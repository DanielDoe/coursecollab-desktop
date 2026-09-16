import { QuizResults } from "@/components/quiz-results"
import { StudentHeader } from "@/components/student-header"

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ type?: string }>
}) {
  const { id } = await params
  const { type } = await searchParams
  const assessmentType = (type === "mid_semester" || type === "final" || type === "homework" || type === "quiz") ? type : "quiz"
  return (
    <div className="min-h-screen bg-[var(--cc-background)]">
      <StudentHeader />
      <main className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <QuizResults attemptId={id} assessmentType={assessmentType} preferDashboardV2 />
      </main>
    </div>
  )
}
