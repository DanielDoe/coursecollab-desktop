"use client"

import { Suspense } from "react"
import { ModuleListSkeleton } from "@/components/data/module-list-skeleton"
import { InstructorQuestionBankContent } from "@/components/instructor-question-bank-content"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

export default function AssessmentsQuizzesQuestionBankPage() {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-5">
          <Suspense
            fallback={
              <ModuleListSkeleton rows={8} className="min-h-[300px]" />
            }
          >
            <InstructorQuestionBankContent embedded />
          </Suspense>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
