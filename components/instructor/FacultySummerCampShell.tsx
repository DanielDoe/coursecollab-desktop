"use client"

import type { ReactNode } from "react"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { cn } from "@/lib/utils"

type Props = {
  children: ReactNode
  className?: string
}

/** Lightweight wrapper for summer-camp sub-routes (training editor, module pages). */
export function FacultySummerCampShell({ children, className }: Props) {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className={cn("w-full min-w-0 p-3 sm:p-4 md:p-5", className)}>{children}</div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
