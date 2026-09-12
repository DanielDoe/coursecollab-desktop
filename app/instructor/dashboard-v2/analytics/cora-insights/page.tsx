"use client"

import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { CoraInsightsDashboard } from "@/components/instructor/cora-insights/CoraInsightsDashboard"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

export default function CoraInsightsPage() {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <CoraInsightsDashboard />
      </EmbedModuleCard>
    </PageEnter>
  )
}
