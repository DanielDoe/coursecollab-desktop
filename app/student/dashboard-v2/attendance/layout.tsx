"use client"

import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { AttendanceBrowseShell } from "@/components/student/dashboard-v2/AttendanceBrowseShell"

export default function AttendanceHubLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageEnter className="w-full min-w-0">
      <EmbedModuleCard>
        <div className="p-4 sm:p-5">
          <AttendanceBrowseShell>{children}</AttendanceBrowseShell>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
