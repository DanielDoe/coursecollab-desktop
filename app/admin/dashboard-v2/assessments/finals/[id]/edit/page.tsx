"use client"

import { use } from "react"
import { AssessmentProvider } from "@/context/assessment-context"
import { EditQuizForm } from "@/components/edit-quiz-form"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

interface EditFinalPageProps {
  params: Promise<{ id: string }>
}

export default function EditFinalPage({ params }: EditFinalPageProps) {
  const { id } = use(params)

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-5">
          <AssessmentProvider type="final">
            <EditQuizForm quizId={id} assessmentType="final" embedInDashboard />
          </AssessmentProvider>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
