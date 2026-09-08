"use client"

import type { ReactNode } from "react"
import {
  dashboardV2ModuleShellClass,
  dashboardV2PageRootClass,
  DASHBOARD_V2_PANEL_SCROLL_ATTR,
  type DashboardV2ModuleScrollMode,
} from "@/lib/dashboard-v2-layout"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { cn } from "@/lib/utils"

type Props = {
  children: ReactNode
  /** `page` — main scrolls. `panel` — fill viewport; panes scroll internally. */
  scrollMode?: DashboardV2ModuleScrollMode
}

/** Standard dashboard-v2 module page shell (matches quizzes / messages). */
export function StudentDashboardModulePage({ children, scrollMode = "page" }: Props) {
  const desktopChrome = isDesktopAppShell()
  const isPanel = scrollMode === "panel"
  const shellClass = dashboardV2ModuleShellClass(scrollMode)
  const panelAttrs = isPanel ? ({ [DASHBOARD_V2_PANEL_SCROLL_ATTR]: "panel" } as const) : {}
  const rootClass = isPanel ? cn(shellClass, "overflow-hidden") : cn(dashboardV2PageRootClass, shellClass)
  const cardClass = isPanel ? cn(shellClass, "min-h-0 overflow-hidden") : shellClass
  const bodyClass = isPanel ? cn(shellClass, "min-h-0 overflow-hidden") : desktopChrome ? shellClass : "p-4 sm:p-5"

  return (
    <PageEnter className={rootClass} {...panelAttrs}>
      <EmbedModuleCard className={cardClass}>
        <div className={bodyClass}>{children}</div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
