"use client"

import dynamic from "next/dynamic"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { AssessmentHistorySkeleton } from "@/components/assessment-history"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

const AssessmentHistory = dynamic(
  () => import("@/components/assessment-history").then((m) => ({ default: m.AssessmentHistory })),
  { loading: () => <AssessmentHistorySkeleton embedInDashboard /> },
)

export default function DashboardV2QuizHistoryPage() {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 p-3 sm:p-4 md:p-5">
          <AssessmentHistory embedInDashboard />
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
