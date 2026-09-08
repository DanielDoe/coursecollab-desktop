"use client"

import type { ReactNode } from "react"
import {
  FacultyIntegratedToolbar,
  type FacultyIntegratedToolbarProps,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { AM_PANEL_SECTION } from "@/lib/assessments/assessment-management-surface-classes"
import { cn } from "@/lib/utils"

export type FacultyAdministrationWorkspaceProps = Omit<
  FacultyIntegratedToolbarProps,
  "className"
> & {
  children: ReactNode
  className?: string
  /** Fill dashboard panel height and scroll list content internally. */
  panel?: boolean
}

/** Integrated search + filters bar for faculty administration modules. */
export function FacultyAdministrationWorkspace({
  children,
  className,
  meta,
  panel = true,
  ...toolbar
}: FacultyAdministrationWorkspaceProps) {
  return (
    <div className={cn(panel ? cn(AM_PANEL_SECTION, "gap-4") : "min-w-0 space-y-4", className)}>
      <FacultyIntegratedToolbar className="shrink-0" {...toolbar} meta={meta} />
      <div className={cn("min-w-0", panel && "flex min-h-0 flex-1 flex-col overflow-hidden")}>{children}</div>
    </div>
  )
}

export function facultyAdminMetaLine(text: string) {
  return <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{text}</p>
}
