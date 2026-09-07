"use client"

import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { LecturesManagement } from "@/components/lectures-management"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

export default function ContentLecturesPage() {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 p-3 sm:p-4 md:p-5">
          <LecturesManagement embedInDashboard />
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
