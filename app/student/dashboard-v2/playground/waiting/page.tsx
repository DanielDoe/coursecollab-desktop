"use client"

import { PlaygroundWaitingRoom } from "@/components/playground-waiting-room"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

export default function DashboardV2PlaygroundWaitingPage() {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="p-3 sm:p-4 md:p-5">
          <PlaygroundWaitingRoom
            backPath="/student/dashboard-v2/playground"
            gamePath="/student/dashboard-v2/playground/game"
          />
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
