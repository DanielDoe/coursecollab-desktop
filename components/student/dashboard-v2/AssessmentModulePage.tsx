"use client"

import dynamic from "next/dynamic"
import { AssessmentTypeProvider } from "@/context/assessment-type-context"
import { AssessmentDashboardShell } from "@/components/student/dashboard-v2/assessment-dashboard-shell"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

const QuizList = dynamic(
  () => import("@/components/quiz-list").then((m) => ({ default: m.QuizList })),
  { loading: () => <ModulePageSkeleton className="min-h-[360px]" /> },
)

const QuizIssuesPanel = dynamic(
  () => import("@/components/quiz-issues-panel").then((m) => ({ default: m.QuizIssuesPanel })),
  { loading: () => <ModulePageSkeleton className="min-h-[240px]" /> },
)

type Props = { assessmentType: "quiz" | "homework" | "mid_semester" | "final" }

export function AssessmentModulePage({ assessmentType }: Props) {
  return (
    <AssessmentTypeProvider assessmentType={assessmentType}>
      <PageEnter className={dashboardV2PageRootClass}>
        <AssessmentDashboardShell
          main={<QuizList embedInDashboard />}
          sidebar={<QuizIssuesPanel embedInDashboard />}
        />
      </PageEnter>
    </AssessmentTypeProvider>
  )
}
