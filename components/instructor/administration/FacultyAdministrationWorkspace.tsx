"use client"

import type { ReactNode } from "react"
import {
  FacultyIntegratedToolbar,
  type FacultyIntegratedToolbarProps,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

export type FacultyAdministrationWorkspaceProps = Omit<
  FacultyIntegratedToolbarProps,
  "className"
> & {
  children: ReactNode
  className?: string
}

/** Integrated search + filters bar for faculty administration modules. */
export function FacultyAdministrationWorkspace({
  children,
  className,
  meta,
  ...toolbar
}: FacultyAdministrationWorkspaceProps) {
  return (
    <div className={cn("min-w-0 space-y-4", className)}>
      <FacultyIntegratedToolbar {...toolbar} meta={meta} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function facultyAdminMetaLine(text: string) {
  return <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{text}</p>
}
