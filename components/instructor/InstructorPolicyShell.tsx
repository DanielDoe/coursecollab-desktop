"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { dashboardV2CardBodyClass } from "@/lib/dashboard-v2-layout"
import { cn } from "@/lib/utils"
import { useFacultyModuleTheme } from "@/hooks/use-faculty-module-theme"
import { portalAccentIconClass, portalIconBadgeClass } from "@/lib/portal-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

type InstructorPolicyShellProps = {
  title: string
  description: string
  icon: LucideIcon
  children: ReactNode
  showHeader?: boolean
  className?: string
  moduleId?: string
}

export function InstructorPolicyShell({
  title,
  description,
  icon: Icon,
  children,
  showHeader = true,
  className,
  moduleId,
}: InstructorPolicyShellProps) {
  const theme = useFacultyModuleTheme(moduleId)

  return (
    <div className={cn(dashboardV2CardBodyClass, "space-y-4", className)}>
      {showHeader ? (
        <div className="flex min-w-0 items-start gap-3">
          <span className={portalIconBadgeClass(theme, "md")}>
            <Icon className={cn("h-5 w-5", portalAccentIconClass(theme))} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className={cn("text-lg font-semibold sm:text-xl", PORTAL_TEXT)}>{title}</h1>
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>{description}</p>
          </div>
        </div>
      ) : null}
      <div className="w-full min-w-0">{children}</div>
    </div>
  )
}
