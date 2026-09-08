"use client"

import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { SettingsBrowseShell } from "@/components/student/dashboard-v2/SettingsBrowseShell"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

export default function SettingsHubLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard className="shrink-0">
        <div className="shrink-0 p-4 sm:p-5 md:p-6">
          <SettingsBrowseShell>{children}</SettingsBrowseShell>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
