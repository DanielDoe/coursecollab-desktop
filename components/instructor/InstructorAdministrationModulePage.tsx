"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { InstructorPolicyShell } from "@/components/instructor/InstructorPolicyShell"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

type InstructorAdministrationModulePageProps = {
  title: string
  description: string
  icon: LucideIcon
  children: ReactNode
  moduleId: string
  showHeader?: boolean
  /** Skip outer CardWrapper — use when breadcrumbs already title the page. Defaults to !showHeader. */
  bare?: boolean
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
}: InstructorAdministrationModulePageProps) {
  const isBare = bare ?? !showHeader

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 p-3 sm:p-4 md:p-5">
          <InstructorPolicyShell
            title={title}
            description={description}
            icon={icon}
            moduleId={moduleId}
            showHeader={showHeader}
            className={isBare ? "p-0" : undefined}
          >
            {children}
          </InstructorPolicyShell>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
