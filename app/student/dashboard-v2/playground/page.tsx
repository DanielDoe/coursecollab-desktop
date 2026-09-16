"use client"

import dynamic from "next/dynamic"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

const PlaygroundLobbyDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/PlaygroundLobbyDashboardV2").then((m) => ({
      default: m.PlaygroundLobbyDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function DashboardV2PlaygroundPage() {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="p-3 sm:p-4 md:p-5">
          <PlaygroundLobbyDashboardV2 />
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
