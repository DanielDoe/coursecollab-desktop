"use client"

import { Suspense, use } from "react"
import { useSearchParams } from "next/navigation"
import { EditQuestionForm } from "@/components/edit-question-form"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { INSTRUCTOR_V2_QUESTION_BANK_PATH } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { Loader2 } from "lucide-react"

function V2EditQuestionBankInner({ id }: { id: string }) {
  const searchParams = useSearchParams()
  const returnTo = searchParams.get("returnTo")

  return (
    <EditQuestionForm
      questionId={id}
      userType="instructor"
      bankListPath={INSTRUCTOR_V2_QUESTION_BANK_PATH}
      returnTo={returnTo}
      embedInDashboard
    />
  )
}

export default function V2EditQuestionBankPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-5">
          <Suspense
            fallback={
              <div className="flex min-h-[240px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent)]" />
              </div>
            }
          >
            <V2EditQuestionBankInner id={id} />
          </Suspense>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
