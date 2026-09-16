"use client"

import { FlashcardsHome } from "@/components/student/flashcards/flashcards-home"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"

export default function DashboardV2FlashcardsPage() {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="p-4 sm:p-5">
          <FlashcardsHome />
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
