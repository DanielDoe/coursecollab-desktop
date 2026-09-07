"use client"

import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { AttendanceBrowseShell } from "@/components/student/dashboard-v2/AttendanceBrowseShell"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"

export default function AttendanceHubLayout({ children }: { children: React.ReactNode }) {
  const desktopChrome = isDesktopAppShell()

  if (desktopChrome) {
    return (
      <PageEnter className={`${dashboardV2PageRootClass} flex min-h-0 flex-1 flex-col`}>
        <EmbedModuleCard className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5 md:p-6">
            <AttendanceBrowseShell>{children}</AttendanceBrowseShell>
          </div>
        </EmbedModuleCard>
      </PageEnter>
    )
  }

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="p-4 sm:p-5">
          <AttendanceBrowseShell>{children}</AttendanceBrowseShell>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
