"use client"

import { CodeBenchHubDashboardV2 } from "@/components/student/dashboard-v2/CodeBenchHubDashboardV2"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"

export default function DashboardV2CodebenchPage() {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <CodeBenchHubDashboardV2 />
      </EmbedModuleCard>
    </PageEnter>
  )
}
