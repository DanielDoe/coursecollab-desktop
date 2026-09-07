"use client"

import { use } from "react"
import { AssessmentProvider } from "@/context/assessment-context"
import { QuizPreview } from "@/components/quiz-preview"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

interface PreviewMidSemesterPageProps {
  params: Promise<{ id: string }>
}

export default function PreviewMidSemesterPage({ params }: PreviewMidSemesterPageProps) {
  const { id } = use(params)

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard className="border-0 shadow-none">
        <div className="w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-5">
          <AssessmentProvider type="mid_semester">
            <QuizPreview quizId={id} assessmentType="mid_semester" embedInDashboard />
          </AssessmentProvider>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
