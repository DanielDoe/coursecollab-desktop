"use client"

import { AssessmentProvider } from "@/context/assessment-context"
import { InstructorQuizManagement } from "@/components/instructor-quiz-management"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

export default function AssessmentsFinalsPage() {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 p-3 sm:p-4 md:p-5">
          <AssessmentProvider type="final">
            <InstructorQuizManagement embedInDashboard />
          </AssessmentProvider>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
