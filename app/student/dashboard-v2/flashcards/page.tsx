"use client"

import { FlashcardsHome } from "@/components/student/flashcards/flashcards-home"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"

export default function DashboardV2FlashcardsPage() {
  if (isDesktopAppShell()) {
    return (
      <PageEnter className={`${dashboardV2PageRootClass} flex min-h-0 flex-1 flex-col`}>
        <EmbedModuleCard className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5 md:p-6">
            <FlashcardsHome />
          </div>
        </EmbedModuleCard>
      </PageEnter>
    )
  }

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
