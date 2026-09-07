"use client"

import { CreateQuestionForm } from "@/components/create-question-form"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { INSTRUCTOR_V2_QUESTION_BANK_PATH } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

export default function V2NewQuestionBankPage() {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-5">
          <CreateQuestionForm
            userType="instructor"
            bankListPath={INSTRUCTOR_V2_QUESTION_BANK_PATH}
            embedInDashboard
          />
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
