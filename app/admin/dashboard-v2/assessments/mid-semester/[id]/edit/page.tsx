"use client"

import { use } from "react"
import { AssessmentProvider } from "@/context/assessment-context"
import { EditQuizForm } from "@/components/edit-quiz-form"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

interface EditMidSemesterPageProps {
  params: Promise<{ id: string }>
}

export default function EditMidSemesterPage({ params }: EditMidSemesterPageProps) {
  const { id } = use(params)

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-5">
          <AssessmentProvider type="mid_semester">
            <EditQuizForm quizId={id} assessmentType="mid_semester" embedInDashboard />
          </AssessmentProvider>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
