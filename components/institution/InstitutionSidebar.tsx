"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useIsLg } from "@/hooks/use-breakpoint"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DrawerNavItem } from "@/components/dashboard-v2/DrawerNavItem"
import { isItemActive, type NavGroup, type NavItem } from "@/lib/portal-nav-config"
import {
  INSTITUTION_DASHBOARD_BASE,
  INSTITUTION_DASHBOARD_LINK,
  INSTITUTION_NAV_GROUPS,
} from "@/lib/institution-portal-nav-config"
import { useInstitutionDashboard } from "./InstitutionDashboardContext"

function SidebarCollapsedTooltip({
  label,
  collapsed,
  children,
}: {
  label: string
  collapsed: boolean
  children: ReactNode
}) {
  if (!collapsed) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="text-xs font-medium">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function NavItemLink({
  item,
  collapsed,
  onNavigate,
  isActive,
}: {
  item: NavItem
  collapsed: boolean
  onNavigate: () => void
  isActive: boolean
}) {
  return (
    <SidebarCollapsedTooltip label={item.label} collapsed={collapsed}>
      <DrawerNavItem
        href={item.href}
        label={item.label}
        isActive={isActive}
        collapsed={collapsed}
        onNavigate={onNavigate}
        icon={item.icon}
      />
    </SidebarCollapsedTooltip>
  )
}

function FlatNavSection({
  group,
  pathname,
  collapsed,
  onNavigate,
}: {
  group: NavGroup
  pathname: string
  collapsed: boolean
  onNavigate: () => void
}) {
  return (
    <section className="pt-0.5">
      <div className="my-2.5 mx-3 border-t border-[var(--cc-drawer-soft-border)]" aria-hidden />
      {!collapsed ? (
        <p className="px-4 pb-1.5 pt-0.5 text-[13px] font-semibold tracking-tight text-[var(--cc-drawer-label-secondary)]">
          {group.title}
        </p>
      ) : null}
      <div className="space-y-0.5">
        {group.items.map((item) => (
          <NavItemLink
            key={item.id}
            item={item}
            collapsed={collapsed}
            onNavigate={onNavigate}
            isActive={isItemActive(item, pathname, INSTITUTION_DASHBOARD_BASE)}
          />
        ))}
      </div>
    </section>
  )
}

export function InstitutionSidebar() {
  const pathname = usePathname() || ""
  const isLg = useIsLg()
  const { mobileSidebarOpen, setMobileSidebarOpen, sidebarCollapsed } = useInstitutionDashboard()
  const iconOnlySidebar = isLg && sidebarCollapsed && !mobileSidebarOpen
  const onNavigate = () => setMobileSidebarOpen(false)
  const isDashboardActive = pathname === INSTITUTION_DASHBOARD_LINK.href

  const desktopSidebarWidthClass = sidebarCollapsed
    ? "lg:w-20 lg:min-w-20 lg:max-w-20"
    : "lg:w-72 lg:min-w-72 lg:max-w-72"

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-500",
          mobileSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setMobileSidebarOpen(false)}
        aria-hidden
      />
      <aside
        data-tour="sidebar"
        className={cn(
          "fixed left-0 top-16 z-50 h-[calc(100vh-4rem)]",
          desktopSidebarWidthClass,
          "max-lg:w-[min(80vw,280px)] max-lg:max-w-[280px]",
          "shrink-0 overflow-x-hidden transition-[width] duration-300 ease-out",
          "bg-[var(--cc-drawer-panel-bg)]",
          "border-r border-[var(--cc-drawer-border)]",
          "rounded-r-2xl sm:rounded-r-3xl",
          "shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)]",
          "lg:translate-x-0",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <nav className="flex h-full flex-col overflow-y-auto overflow-x-hidden overscroll-contain px-2 py-4 scrollbar-hide sm:px-3 sm:py-6">
          <TooltipProvider delayDuration={300}>
            <div className="space-y-1">
              <NavItemLink
                item={INSTITUTION_DASHBOARD_LINK}
                collapsed={iconOnlySidebar}
                onNavigate={onNavigate}
                isActive={isDashboardActive}
              />
              {INSTITUTION_NAV_GROUPS.map((group) =>
                group.items.length === 1 ? (
                  <section key={group.id} className="pt-0.5">
                    <div className="my-2.5 mx-3 border-t border-[var(--cc-drawer-soft-border)]" aria-hidden />
                    <NavItemLink
                      item={group.items[0]}
                      collapsed={iconOnlySidebar}
                      onNavigate={onNavigate}
                      isActive={isItemActive(group.items[0], pathname, INSTITUTION_DASHBOARD_BASE)}
                    />
                  </section>
                ) : (
                  <FlatNavSection
                    key={group.id}
                    group={group}
                    pathname={pathname}
                    collapsed={iconOnlySidebar}
                    onNavigate={onNavigate}
                  />
                ),
              )}
            </div>
          </TooltipProvider>
        </nav>
      </aside>
    </>
  )
}
