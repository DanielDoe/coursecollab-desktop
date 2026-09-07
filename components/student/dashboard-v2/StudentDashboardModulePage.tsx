"use client"

import type { ReactNode } from "react"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"

type Props = {
  children: ReactNode
}

/** Standard dashboard-v2 module page shell (matches quizzes / messages). */
export function StudentDashboardModulePage({ children }: Props) {
  const desktopChrome = isDesktopAppShell()

  if (desktopChrome) {
    return (
      <PageEnter className={`${dashboardV2PageRootClass} flex min-h-0 flex-1 flex-col`}>
        <EmbedModuleCard className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5 md:p-6">{children}</div>
        </EmbedModuleCard>
      </PageEnter>
    )
  }

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="p-4 sm:p-5">{children}</div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
