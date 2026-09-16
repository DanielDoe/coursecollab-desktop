"use client"

import type { ReactNode } from "react"
import {
  FacultyModuleSideMenu,
  type FacultySideMenuItem,
} from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { ModuleListSkeleton } from "@/components/data/module-list-skeleton"
import {
  DesktopChromeTitle,
  DesktopChromeTitleActions,
} from "@/components/dashboard-v2/DashboardChromeTitlePortal"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import {
  dashboardV2ModuleShellClass,
  type DashboardV2ModuleScrollMode,
} from "@/lib/dashboard-v2-layout"
import { cn } from "@/lib/utils"

type Props = {
  moduleId: string
  title: string
  metaLine: ReactNode
  metaSuffix?: string
  headerAction?: ReactNode
  toolbar?: ReactNode
  menuItems: FacultySideMenuItem[]
  menuView: string
  onMenuSelect: (id: string) => void
  children: ReactNode
  footer?: ReactNode
  loading?: boolean
  loadingRows?: number
  /** Single-pane modules skip the browse side menu but keep the hub header. */
  hideSideMenu?: boolean
  /** Match StudentDashboardModulePage: page scroll vs panel-internal scroll. */
  scrollMode?: DashboardV2ModuleScrollMode
}

export function StudentModuleHubLayout({
  moduleId,
  title,
  metaLine,
  metaSuffix,
  headerAction,
  toolbar,
  menuItems,
  menuView,
  onMenuSelect,
  children,
  footer,
  loading = false,
  loadingRows = 6,
  hideSideMenu = false,
  scrollMode = "page",
}: Props) {
  const desktopChrome = isDesktopAppShell()
  const panelShell = dashboardV2ModuleShellClass(scrollMode)

  const desktopChromeSlots = desktopChrome ? (
    <>
      <DesktopChromeTitle>
        <div className="flex min-w-0 items-center gap-1.5">
          <h1 className="shrink-0 truncate text-[16px] font-semibold tracking-tight">{title}</h1>
          <span className="shrink-0 text-[12px] text-[#6b7280] dark:text-[#9ca3af]" aria-hidden>
            ·
          </span>
          <p className="min-w-0 truncate text-[12px] leading-4 text-[#6b7280] dark:text-[#9ca3af]">
            {metaLine}
          </p>
        </div>
      </DesktopChromeTitle>
      {headerAction ? <DesktopChromeTitleActions>{headerAction}</DesktopChromeTitleActions> : null}
    </>
  ) : null

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-3 border-t border-[color-mix(in_srgb,var(--cc-text)_10%,transparent)] pt-3 sm:pt-4",
        scrollMode === "panel" && "min-h-0 flex-1",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 shrink-0 flex-col gap-3",
          desktopChrome
            ? "border-0 bg-transparent p-0"
            : "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4",
        )}
      >
        {desktopChrome ? (
          desktopChromeSlots
        ) : (
          <div className="flex min-w-0 items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
                {title}
              </p>
              <p className="mt-0.5 truncate text-sm text-[var(--cc-text)]">
                {metaLine}
                {metaSuffix ? (
                  <span className="text-[var(--cc-text-muted)]"> · {metaSuffix}</span>
                ) : null}
              </p>
            </div>
            {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
          </div>
        )}

        {toolbar ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">{toolbar}</div>
        ) : null}
      </div>

      {hideSideMenu ? (
        <div className={cn("@container/student-hub relative min-w-0 w-full", panelShell)}>
          {loading ? <ModuleListSkeleton rows={loadingRows} className="min-h-[280px]" /> : null}
          <div className={cn(panelShell, loading && "hidden")}>{children}</div>
        </div>
      ) : (
        <FacultyModuleSplitLayout
          className="gap-3"
          splitMode="container"
          containerName="student-hub"
          scrollMode={scrollMode}
          menuWidthClass="w-full @[720px]/student-hub:w-44 @[880px]/student-hub:w-52"
          menu={
            <FacultyModuleSideMenu
              embedded
              className="@[720px]/student-hub:border-r @[720px]/student-hub:border-[var(--border)] @[720px]/student-hub:pr-4"
              moduleId={moduleId}
              accent={{ soft: "var(--cc-accent-soft)", ink: "var(--cc-text)" }}
              title="Browse"
              activeId={menuView}
              onSelect={onMenuSelect}
              items={menuItems}
            />
          }
        >
          <div
            className={cn(
              "relative min-w-0 w-full",
              scrollMode === "panel" ? "flex min-h-0 flex-1 flex-col" : "w-full",
            )}
          >
            {loading ? <ModuleListSkeleton rows={loadingRows} className="min-h-[280px]" /> : null}
            <div className={cn(scrollMode === "panel" && "flex min-h-0 flex-1 flex-col", loading && "hidden")}>
              {children}
            </div>
          </div>
        </FacultyModuleSplitLayout>
      )}

      {footer ? <div className="shrink-0">{footer}</div> : null}
    </div>
  )
}
