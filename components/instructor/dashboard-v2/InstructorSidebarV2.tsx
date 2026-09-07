"use client"

import type { ReactNode } from "react"
import { useIsLg } from "@/hooks/use-breakpoint"
import { usePathname, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { useIntentPrefetch } from "@/hooks/data/use-intent-prefetch"
import { cn } from "@/lib/utils"
import { useInstructorDashboardV2 } from "./InstructorDashboardV2Context"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { isItemActive, type NavGroup, type NavItem } from "@/lib/portal-nav-config"
import { CoraSidebarMark } from "@/components/cora/CoraLogo"
import { ShellSidebarHeader } from "@/components/dashboard-v2/ShellSidebarHeader"
import { ShellSidebarFooter } from "@/components/dashboard-v2/ShellSidebarFooter"
import {
  magnificShellCardClass,
  magnificSidebarNavIconClass,
  magnificSidebarNavItemActiveClass,
  magnificSidebarNavItemClass,
} from "@/lib/appearance/magnific-shell"
import Link from "next/link"

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

function NavLink({
  item,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
  onNavigate: () => void
}) {
  const { onIntentEnter, onIntentLeave } = useIntentPrefetch()
  const Icon = item.icon

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      onMouseEnter={() => onIntentEnter(item.href)}
      onMouseLeave={onIntentLeave}
      onFocus={() => onIntentEnter(item.href)}
      className={cn(
        "group flex items-center gap-3 px-3 py-2 text-[14px] font-normal",
        magnificSidebarNavItemClass,
        collapsed && "justify-center px-2 py-2.5",
        isActive ? magnificSidebarNavItemActiveClass : null,
      )}
    >
      <span className="flex w-6 shrink-0 items-center justify-center">
        {item.id === "cora-copilot" ? (
          <CoraSidebarMark />
        ) : Icon ? (
          <Icon
            className={cn("size-[18px]", magnificSidebarNavIconClass(isActive))}
            strokeWidth={1.75}
            aria-hidden
          />
        ) : null}
      </span>
      {!collapsed ? <span className="flex-1 truncate leading-5">{item.label}</span> : null}
    </Link>
  )

  return (
    <SidebarCollapsedTooltip label={item.label} collapsed={collapsed}>
      {link}
    </SidebarCollapsedTooltip>
  )
}

function FlatNavSection({
  group,
  pathname,
  basePath,
  currentSearch,
  collapsed,
  onNavigate,
  showLeadingDivider = true,
}: {
  group: NavGroup
  pathname: string
  basePath: string
  currentSearch: string
  collapsed: boolean
  onNavigate: () => void
  showLeadingDivider?: boolean
}) {
  return (
    <section className="pt-0.5">
      {showLeadingDivider ? (
        <div className="my-2 border-t border-[#EBEBEB] dark:border-[#262626]" aria-hidden />
      ) : null}
      <div className="space-y-0.5">
        {group.items.map((item) => (
          <NavLink
            key={item.id}
            item={item}
            isActive={isItemActive(item, pathname, basePath, currentSearch)}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  )
}

/** Magnific-style faculty drawer — matches student dashboard-v2 shell. */
export function InstructorSidebarV2() {
  const {
    mobileSidebarOpen,
    setMobileSidebarOpen,
    sidebarCollapsed,
    setSearchOpen,
    basePath,
    dashboardLink,
    navGroups,
  } = useInstructorDashboardV2()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentSearch = searchParams?.toString() ?? ""
  const isLg = useIsLg()

  const isDashboardActive = pathname === dashboardLink.href || pathname === basePath
  const iconOnlySidebar = isLg && sidebarCollapsed && !mobileSidebarOpen

  const onNavigate = () => {
    setMobileSidebarOpen(false)
  }

  const desktopSidebarWidthClass = sidebarCollapsed
    ? "lg:w-[72px] lg:min-w-[72px] lg:max-w-[72px]"
    : "lg:w-[230px] lg:min-w-[230px] lg:max-w-[230px]"

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden transition-opacity duration-300",
          mobileSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setMobileSidebarOpen(false)}
        aria-hidden
      />

      <aside
        data-tour="sidebar"
        className={cn(
          "z-50 flex shrink-0 flex-col overflow-hidden transition-[width] duration-300 ease-out",
          desktopSidebarWidthClass,
          magnificShellCardClass,
          "lg:h-full",
          "max-lg:fixed max-lg:left-0 max-lg:top-0 max-lg:h-[100dvh] max-lg:w-[min(80vw,280px)] max-lg:max-w-[280px]",
          "max-lg:rounded-r-2xl max-lg:border-r max-lg:border-[#EBEBEB] max-lg:bg-white max-lg:shadow-xl",
          "dark:max-lg:bg-[#111111] dark:max-lg:border-[#262626]",
          mobileSidebarOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
        )}
      >
        <nav className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-2 pt-1 sm:px-2.5">
          <TooltipProvider delayDuration={300}>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden scrollbar-hide overscroll-contain">
                <ShellSidebarHeader collapsed={iconOnlySidebar} homeHref={basePath} />

                {!iconOnlySidebar ? (
                  <SidebarCollapsedTooltip label="Search" collapsed={false}>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchOpen(true)
                        setMobileSidebarOpen(false)
                      }}
                      className={cn(
                        "mx-0 mb-1 flex w-full items-center gap-3 px-3 py-2 text-[14px] font-normal",
                        magnificSidebarNavItemClass,
                      )}
                    >
                      <Search className="size-[18px] shrink-0" strokeWidth={1.75} />
                      <span>Search</span>
                    </button>
                  </SidebarCollapsedTooltip>
                ) : (
                  <SidebarCollapsedTooltip label="Search" collapsed>
                    <button
                      type="button"
                      onClick={() => setSearchOpen(true)}
                      className={cn(
                        "mx-auto mb-1 flex size-9 items-center justify-center",
                        magnificSidebarNavItemClass,
                      )}
                      aria-label="Search"
                    >
                      <Search className="size-[18px]" strokeWidth={1.75} />
                    </button>
                  </SidebarCollapsedTooltip>
                )}

                <div className="min-h-0 flex-1 space-y-0.5">
                  <NavLink
                    item={dashboardLink}
                    isActive={isDashboardActive}
                    collapsed={iconOnlySidebar}
                    onNavigate={onNavigate}
                  />

                  {navGroups.map((group) =>
                    group.items.length === 1 ? (
                      <section key={group.id} className="pt-0.5">
                        <div className="my-2 border-t border-[#EBEBEB] dark:border-[#262626]" aria-hidden />
                        <NavLink
                          item={group.items[0]!}
                          isActive={isItemActive(group.items[0]!, pathname || "", basePath, currentSearch)}
                          collapsed={iconOnlySidebar}
                          onNavigate={onNavigate}
                        />
                      </section>
                    ) : (
                      <FlatNavSection
                        key={group.id}
                        group={group}
                        pathname={pathname || ""}
                        basePath={basePath}
                        currentSearch={currentSearch}
                        collapsed={iconOnlySidebar}
                        onNavigate={onNavigate}
                      />
                    ),
                  )}
                </div>
              </div>

              <ShellSidebarFooter collapsed={iconOnlySidebar} />
            </div>
          </TooltipProvider>
        </nav>
      </aside>
    </>
  )
}
