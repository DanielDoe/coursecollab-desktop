"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { InstructorPolicyShell } from "@/components/instructor/InstructorPolicyShell"
import {
  DASHBOARD_V2_PANEL_SCROLL_ATTR,
  dashboardV2ModuleShellClass,
  dashboardV2PageRootClass,
  type DashboardV2ModuleScrollMode,
} from "@/lib/dashboard-v2-layout"
import { cn } from "@/lib/utils"

type InstructorAdministrationModulePageProps = {
  title: string
  description: string
  icon: LucideIcon
  children: ReactNode
  moduleId: string
  showHeader?: boolean
  /** Skip outer CardWrapper — use when breadcrumbs already title the page. Defaults to !showHeader. */
  bare?: boolean
  /** `panel` fills the dashboard pane; `page` grows with content. */
  scrollMode?: DashboardV2ModuleScrollMode
}

/** Standard full-width administration route shell (matches course content modules). */
export function InstructorAdministrationModulePage({
  title,
  description,
  icon,
  children,
  moduleId,
  showHeader = true,
  bare,
  scrollMode = "panel",
}: InstructorAdministrationModulePageProps) {
  const isBare = bare ?? !showHeader
  const isPanel = scrollMode === "panel"
  const shellClass = dashboardV2ModuleShellClass(scrollMode)
  const panelAttrs = isPanel ? ({ [DASHBOARD_V2_PANEL_SCROLL_ATTR]: "panel" } as const) : {}
  const rootClass = isPanel ? cn(shellClass, "overflow-hidden") : cn(dashboardV2PageRootClass, shellClass)
  const cardClass = isPanel ? cn(shellClass, "min-h-0 overflow-hidden") : undefined
  const bodyClass = isPanel
    ? cn(shellClass, "min-h-0 overflow-hidden")
    : "w-full min-w-0 p-3 sm:p-4 md:p-5"

  return (
    <PageEnter className={rootClass} {...panelAttrs}>
      <EmbedModuleCard className={cardClass}>
        <div className={bodyClass}>
          <InstructorPolicyShell
            title={title}
            description={description}
            icon={icon}
            moduleId={moduleId}
            showHeader={showHeader}
            scrollMode={scrollMode}
            className={isBare ? "p-0" : undefined}
          >
            {children}
          </InstructorPolicyShell>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
