"use client"

import { Suspense } from "react"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { InstitutionAnalyticsHub, InstitutionAnalyticsHubFallback } from "@/components/institution/InstitutionAnalyticsHub"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

export default function InstitutionAnalyticsPage() {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 p-3 sm:p-4 md:p-5">
          <Suspense fallback={<InstitutionAnalyticsHubFallback />}>
            <InstitutionAnalyticsHub />
          </Suspense>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
