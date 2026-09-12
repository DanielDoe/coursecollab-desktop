"use client"

import type { ReactNode } from "react"
import type { DashboardV2ModuleScrollMode } from "@/lib/dashboard-v2-layout"
import { cn } from "@/lib/utils"

type FacultyModuleSplitLayoutProps = {
  menu: ReactNode
  children: ReactNode
  className?: string
  menuWidthClass?: string
  /** Stack menu above content (e.g. horizontal tab bar) instead of left column */
  layout?: "split" | "stack"
  /** Container queries use available pane width (better inside dashboard shells). */
  splitMode?: "viewport" | "container"
  containerName?: string
  /** `page` — content grows; `panel` — fill viewport and scroll inside panes. */
  scrollMode?: DashboardV2ModuleScrollMode
}

/** Tailwind must see full class names — do not build @container utilities from variables. */
const CONTAINER_SHELL: Record<string, { root: string; row: string; menu: string }> = {
  "cora-hub": {
    root: "@container/cora-hub",
    row: "@[720px]/cora-hub:flex-row @[720px]/cora-hub:items-stretch @[720px]/cora-hub:gap-4",
    menu: "@[720px]/cora-hub:w-52",
  },
  "practice-hub": {
    root: "@container/practice-hub",
    row: "@[720px]/practice-hub:flex-row @[720px]/practice-hub:items-stretch @[720px]/practice-hub:gap-4",
    menu: "@[720px]/practice-hub:w-52",
  },
  "faculty-split": {
    root: "@container/faculty-split",
    row: "@[720px]/faculty-split:flex-row @[720px]/faculty-split:items-stretch @[720px]/faculty-split:gap-4",
    menu: "@[720px]/faculty-split:w-52",
  },
  "student-hub": {
    root: "@container/student-hub",
    row: "@[720px]/student-hub:flex-row @[720px]/student-hub:items-stretch @[720px]/student-hub:gap-4",
    menu: "@[720px]/student-hub:w-52",
  },
}

/** Standard faculty dashboard split: nested sidemenu + main content. */
export function FacultyModuleSplitLayout({
  menu,
  children,
  className,
  menuWidthClass = "lg:w-56",
  layout = "split",
  splitMode = "viewport",
  containerName = "faculty-split",
  scrollMode = "panel",
}: FacultyModuleSplitLayoutProps) {
  const panelContentClass =
    "flex min-h-0 min-w-0 w-full flex-1 flex-col self-stretch"
  const pageContentClass = "min-w-0 w-full flex-1 shrink-0 self-stretch"
  const contentClass = scrollMode === "panel" ? panelContentClass : pageContentClass

  if (layout === "stack") {
    return (
      <div className={cn("w-full min-w-0 space-y-4 overflow-x-hidden", className)}>
        {menu}
        <div className={cn("min-w-0", scrollMode === "panel" ? "flex-1" : "w-full shrink-0")}>
          {children}
        </div>
      </div>
    )
  }

  if (splitMode === "container") {
    const shell = CONTAINER_SHELL[containerName] ?? CONTAINER_SHELL["faculty-split"]
    const panelShellClass = scrollMode === "panel" ? "flex min-h-0 flex-1 flex-col overflow-hidden" : ""
    return (
      <div className={cn(shell.root, "w-full min-w-0 overflow-x-hidden", panelShellClass, className)}>
        <div className={cn("flex w-full min-w-0 flex-col gap-3", shell.row, panelShellClass)}>
          {menu ? (
            <div
              className={cn(
                "flex min-h-0 w-full shrink-0 flex-col self-stretch",
                shell.menu,
                menuWidthClass,
              )}
            >
              {menu}
            </div>
          ) : null}
          <div className={cn(contentClass, scrollMode === "panel" && "overflow-hidden")}>{children}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex w-full min-w-0 overflow-x-hidden",
        scrollMode === "panel"
          ? "min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6"
          : "flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6",
        className,
      )}
    >
      {menu ? (
        <div className={cn("flex min-h-0 w-full shrink-0 flex-col self-stretch lg:h-full", menuWidthClass)}>{menu}</div>
      ) : null}
      <div className={contentClass}>{children}</div>
    </div>
  )
}
