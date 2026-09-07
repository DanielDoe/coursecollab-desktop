import { QuizResults } from "@/components/quiz-results"
import { ArrowLeft, GraduationCap } from "lucide-react"
import Link from "next/link"
import { NotificationBell } from "@/components/notification-bell"
import { StudentProfileDropdown } from "@/components/student-profile-dropdown"
import { use } from "react"

const ASSESSMENT_LABELS: Record<string, string> = {
  quiz: "Quiz Report",
  quizzes: "Quiz Report",
  homework: "Homework Report",
  "mid-semester-exams": "Mid-Semester Report",
  "final-exams": "Final Exam Report",
}

export default function AssessmentReportPage({
  params,
}: {
  params: Promise<{ assessmentType: string; attemptId: string }>
}) {
  const { assessmentType, attemptId } = use(params)
  const reportLabel = ASSESSMENT_LABELS[assessmentType] ?? "Assessment Report"

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-800/80 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/student/dashboard-v2"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Back to dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <Link href="/student/dashboard-v2" className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-90">
                <GraduationCap className="h-7 w-7 shrink-0" style={{ color: "var(--cc-accent)" }} />
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-bold leading-tight" style={{ color: "var(--cc-accent)" }}>
                    CourseCollab
                  </h1>
                  <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{reportLabel}</p>
                </div>
              </Link>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <NotificationBell />
              <StudentProfileDropdown />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <QuizResults attemptId={attemptId} assessmentType={assessmentType} preferDashboardV2 />
      </main>
    </div>
  )
}
