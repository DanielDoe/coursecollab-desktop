"use client"

import dynamic from "next/dynamic"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"

const TradeCenterContent = dynamic(
  () => import("@/components/trade-center-content").then((m) => ({ default: m.TradeCenterContent })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function DashboardV2TradeCenterPage() {
  const desktopChrome = isDesktopAppShell()

  if (desktopChrome) {
    return (
      <PageEnter className={`${dashboardV2PageRootClass} flex min-h-0 flex-1 flex-col`}>
        <EmbedModuleCard className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5 md:p-6">
            <TradeCenterContent embedInDashboard />
          </div>
        </EmbedModuleCard>
      </PageEnter>
    )
  }

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
