"use client"

import { use } from "react"
import Link from "next/link"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import {
  DASHBOARD_V2_PANEL_SCROLL_ATTR,
  dashboardV2ModuleShellClass,
} from "@/lib/dashboard-v2-layout"
import { InstructorProjectGradingWorkspace } from "@/components/instructor/projects/InstructorProjectGradingWorkspace"
import { INSTRUCTOR_DASHBOARD_V2_BASE } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const id = Number.parseInt(use(params).projectId, 10)
  return (
    <PageEnter
      className={cn(dashboardV2ModuleShellClass("panel"), "h-full min-h-0 overflow-hidden")}
      {...{ [DASHBOARD_V2_PANEL_SCROLL_ATTR]: "panel" }}
    >
      <EmbedModuleCard className={cn(dashboardV2ModuleShellClass("panel"), "h-full min-h-0 flex-1 overflow-hidden")}>
        <div className="flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 sm:p-4 md:p-5">
          <Button variant="outline" size="sm" className="w-fit shrink-0" asChild>
            <Link href={`${INSTRUCTOR_DASHBOARD_V2_BASE}/management/projects`}>Back</Link>
          </Button>
          <div className="min-h-0 flex-1 overflow-hidden">
            {Number.isFinite(id) ? <InstructorProjectGradingWorkspace projectId={id} /> : null}
          </div>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
