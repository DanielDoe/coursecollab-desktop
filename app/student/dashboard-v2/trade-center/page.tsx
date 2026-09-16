"use client"

import dynamic from "next/dynamic"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const TradeCenterContent = dynamic(
  () => import("@/components/trade-center-content").then((m) => ({ default: m.TradeCenterContent })),
  { loading: () => <ModulePageSkeleton className="min-h-[360px]" /> },
)

export default function DashboardV2TradeCenterPage() {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="p-4 sm:p-5">
          <TradeCenterContent embedInDashboard />
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
