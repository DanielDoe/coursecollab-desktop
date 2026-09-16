"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Gem } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsLg } from "@/hooks/use-breakpoint"
import { CoraSidebarMark } from "@/components/cora/CoraLogo"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  filterGuestNavGroups,
  GUEST_DASHBOARD_HREF,
  GUEST_DASHBOARD_ITEM,
  GUEST_SETTINGS_ITEM,
  type GuestNavGroup,
  type GuestNavItem,
} from "@/lib/guest/guest-nav"
import { GUEST_CORA_CAREER_LIFETIME_CREDITS, guestPlanHasCareerUnlock } from "@/lib/guest/membership-config"
import { useGuestDashboard } from "./GuestDashboardContext"

function NavTooltip({ label, collapsed, children }: { label: string; collapsed: boolean; children: ReactNode }) {
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

function getActiveItemInGroup(group: GuestNavGroup, pathname: string): GuestNavItem | null {
  const matches = group.items.filter(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  )
  if (matches.length === 0) return null
  return matches.reduce((best, curr) => (curr.href.length > best.href.length ? curr : best))
}

function GuestNavLink({
  item,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: GuestNavItem
  isActive: boolean
  collapsed: boolean
  onNavigate: () => void
}) {
  const Icon = item.icon
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-4 rounded-[28px] px-4 py-3 text-[15px] font-medium transition-colors mx-1 min-h-[44px]",
        collapsed && "justify-center px-2 mx-0.5 min-h-[40px] py-2.5",
        isActive
          ? "bg-[var(--cc-drawer-nav-active-bg)] text-[var(--cc-drawer-primary)] font-semibold"
          : "text-[var(--cc-drawer-label)] hover:bg-[var(--cc-drawer-nav-hover-bg)]",
      )}
    >
      <span className="flex w-6 shrink-0 items-center justify-center">
        {item.id === "cora-assistant" ? (
          <CoraSidebarMark />
        ) : (
          <Icon
            className={cn(
              "h-[22px] w-[22px]",
              isActive ? "text-[var(--cc-drawer-primary)]" : "text-[var(--cc-drawer-label-secondary)]",
            )}
            aria-hidden
          />
        )}
      </span>
      {!collapsed && <span className="flex-1 truncate leading-5">{item.label}</span>}
    </Link>
  )
  return (
    <NavTooltip label={item.label} collapsed={collapsed}>
      {link}
    </NavTooltip>
  )
}

function FlatNavSection({
  group,
  pathname,
  collapsed,
  onNavigate,
  showLeadingDivider = true,
}: {
  group: GuestNavGroup
  pathname: string
  collapsed: boolean
  onNavigate: () => void
  showLeadingDivider?: boolean
}) {
  const activeChild = getActiveItemInGroup(group, pathname)

  return (
    <section className="pt-0.5">
      {showLeadingDivider ? (
        <div className="my-2.5 mx-3 border-t border-[var(--cc-drawer-soft-border)]" aria-hidden />
      ) : null}
      {!collapsed ? (
        <p className="px-4 pb-1.5 pt-0.5 text-[13px] font-semibold tracking-tight text-[var(--cc-drawer-label-secondary)]">
          {group.label}
        </p>
      ) : null}
      <div className="space-y-0.5">
        {group.items.map((item) => (
          <GuestNavLink
            key={item.id}
            item={item}
            isActive={activeChild?.id === item.id}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  )
}

export function GuestSidebar() {
  const pathname = usePathname() ?? ""
  const isLg = useIsLg()
  const { mobileSidebarOpen, setMobileSidebarOpen, sidebarCollapsed, entitlements } = useGuestDashboard()
  const iconOnlySidebar = isLg && sidebarCollapsed && !mobileSidebarOpen
  const navGroups = filterGuestNavGroups({
    capabilities: entitlements.capabilities,
    plan: entitlements.plan,
  })
  const hasCareer = guestPlanHasCareerUnlock(entitlements.plan)

  const onNavigate = () => setMobileSidebarOpen(false)

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
        <nav className="flex flex-col h-full overflow-y-auto overflow-x-hidden scrollbar-hide py-4 sm:py-6 px-2 sm:px-3 overscroll-contain">
          <TooltipProvider delayDuration={300}>
            <div className="space-y-1">
              <GuestNavLink
                item={GUEST_DASHBOARD_ITEM}
                isActive={pathname === GUEST_DASHBOARD_HREF}
                collapsed={iconOnlySidebar}
                onNavigate={onNavigate}
              />

              {navGroups.map((group) => (
                <FlatNavSection
                  key={group.id}
                  group={group}
                  pathname={pathname}
                  collapsed={iconOnlySidebar}
                  onNavigate={onNavigate}
                />
              ))}

              <div className="my-2.5 mx-3 border-t border-[var(--cc-drawer-soft-border)]" aria-hidden />
              <GuestNavLink
                item={GUEST_SETTINGS_ITEM}
                isActive={
                  pathname === GUEST_SETTINGS_ITEM.href ||
                  pathname.startsWith(`${GUEST_SETTINGS_ITEM.href}/`) ||
                  pathname === "/guest/profile"
                }
                collapsed={iconOnlySidebar}
                onNavigate={onNavigate}
              />
            </div>

            <div className="mt-auto pt-4 space-y-3">
              {!hasCareer ? (
                !iconOnlySidebar ? (
                  <Link
                    href="/guest/cora-career/access"
                    onClick={onNavigate}
                    className="block rounded-xl bg-[var(--cc-drawer-nav-idle-bg)] backdrop-blur-sm p-3 border border-[var(--cc-drawer-soft-border)] hover:border-[var(--cc-drawer-nav-active-border)] transition-all duration-300"
                  >
                    <h3 className="font-bold text-[var(--cc-drawer-label)] text-sm leading-tight">
                      Unlock Cora Career
                    </h3>
                    <p className="mt-1.5 text-xs text-[var(--cc-drawer-label-secondary)] leading-snug line-clamp-2">
                      Résumé review, interview prep, and {GUEST_CORA_CAREER_LIFETIME_CREDITS.toLocaleString("en-US")} Cora Credits — lifetime access.
                    </p>
                    <span className="mt-3 flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-semibold text-white bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] transition-colors">
                      Get Cora Career
                    </span>
                  </Link>
                ) : (
                  <Link
                    href="/guest/cora-career/access"
                    onClick={onNavigate}
                    className="flex size-12 items-center justify-center rounded-2xl mx-auto text-white bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] transition-colors"
                    aria-label="Get Cora Career"
                  >
                    <Gem className="h-6 w-6" />
                  </Link>
                )
              ) : !iconOnlySidebar && entitlements.credits != null ? (
                <div className="rounded-xl border border-[var(--cc-drawer-soft-border)] bg-[var(--cc-drawer-nav-idle-bg)] p-3 text-xs text-[var(--cc-drawer-label-secondary)]">
                  <p className="font-semibold text-[var(--cc-drawer-label)]">Cora Career active</p>
                  <p className="mt-1">{entitlements.credits.toLocaleString()} credits remaining</p>
                  <Link
                    href="/guest/cora-credits"
                    onClick={onNavigate}
                    className="mt-2 inline-block font-medium text-[var(--cc-accent)] hover:underline"
                  >
                    Add credits
                  </Link>
                </div>
              ) : null}
            </div>
          </TooltipProvider>
        </nav>
      </aside>
    </>
  )
}
