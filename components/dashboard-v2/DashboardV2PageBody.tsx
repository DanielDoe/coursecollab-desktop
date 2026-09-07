"use client"

import { cn } from "@/lib/utils"
import { dashboardV2CardBodyClass } from "@/lib/dashboard-v2-layout"

export function DashboardV2PageBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn(dashboardV2CardBodyClass, className)}>{children}</div>
}
