"use client"

import type { ReactNode } from "react"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { cn } from "@/lib/utils"

type GuestModulePageProps = {
  children: ReactNode
  className?: string
  cardClassName?: string
  bodyClassName?: string
  /** Render without EmbedModuleCard (component supplies its own shell). */
  bare?: boolean
  immersive?: boolean
  toolbar?: ReactNode
}

export function GuestModulePage({
  children,
  className,
  cardClassName,
  bodyClassName,
  bare = false,
  immersive = false,
  toolbar,
}: GuestModulePageProps) {
  return (
    <PageEnter
      className={cn(
        dashboardV2PageRootClass,
        immersive && "flex min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      {bare ? (
        children
      ) : (
        <EmbedModuleCard
          className={cn(
            immersive && "flex min-h-0 flex-1 flex-col overflow-hidden border-0 shadow-none",
            cardClassName,
          )}
          toolbar={toolbar}
        >
          <div
            className={cn(
              immersive ? "flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4" : "p-4 sm:p-5",
              bodyClassName,
            )}
          >
            {children}
          </div>
        </EmbedModuleCard>
      )}
    </PageEnter>
  )
}
