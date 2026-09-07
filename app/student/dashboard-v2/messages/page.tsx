"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"

const MessagesDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/MessagesDashboardV2").then((m) => ({
      default: m.MessagesDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[480px]" /> },
)

function MessagesPageContent() {
  const desktopChrome = isDesktopAppShell()

  if (desktopChrome) {
    return (
      <PageEnter className={`${dashboardV2PageRootClass} flex min-h-0 flex-1 flex-col`}>
        <EmbedModuleCard className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5 md:p-6">
            <MessagesDashboardV2 />
          </div>
        </EmbedModuleCard>
      </PageEnter>
    )
  }

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="p-4 sm:p-5">
          <MessagesDashboardV2 />
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}

export default function StudentMessagesPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton className="min-h-[480px]" />}>
      <MessagesPageContent />
    </Suspense>
  )
}
