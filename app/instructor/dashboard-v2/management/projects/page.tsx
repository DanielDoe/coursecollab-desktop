"use client"

import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import InstructorProjectsPage from "@/app/instructor/projects/page"
import { cn } from "@/lib/utils"
import {
  DASHBOARD_V2_PANEL_SCROLL_ATTR,
  dashboardV2ModuleShellClass,
} from "@/lib/dashboard-v2-layout"

export default function ManagementProjectsPage() {
  return (
    <PageEnter
      className={cn(dashboardV2ModuleShellClass("panel"), "h-full min-h-0 overflow-hidden")}
      {...{ [DASHBOARD_V2_PANEL_SCROLL_ATTR]: "panel" }}
    >
      <EmbedModuleCard
        className={cn(dashboardV2ModuleShellClass("panel"), "h-full min-h-0 flex-1 overflow-hidden")}
      >
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-4 md:p-5">
          <InstructorProjectsPage embedInDashboard />
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
