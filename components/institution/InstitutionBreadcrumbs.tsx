"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, LayoutDashboard, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { NavGroup } from "@/lib/portal-nav-config"
import {
  INSTITUTION_DASHBOARD_BASE,
  INSTITUTION_DASHBOARD_LINK,
  INSTITUTION_NAV_GROUPS,
} from "@/lib/institution-portal-nav-config"

type CrumbPart = { href: string; label: string; groupId?: string; nonNavigable?: boolean }

const SEGMENT_LABELS: Record<string, string> = {
  license: "License",
  organization: "Organization",
  faculty: "Faculty",
  students: "Students",
  courses: "Courses",
  cora: "Cora Usage",
  analytics: "Analytics",
  billing: "Billing",
  invoices: "Invoices",
  settings: "Settings",
}

function navHrefPath(href: string): string {
  return href.split("?")[0] ?? href
}

function buildPathMap(navGroups: NavGroup[]): Map<string, { label: string; group: NavGroup }> {
  const map = new Map<string, { label: string; group: NavGroup }>()
  for (const group of navGroups) {
    for (const item of group.items) {
      map.set(navHrefPath(item.href), { label: item.label, group })
    }
  }
  return map
}

function getLabelForSegment(seg: string): string {
  return SEGMENT_LABELS[seg] ?? seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function getBreadcrumbParts(pathname: string): CrumbPart[] {
  const base = INSTITUTION_DASHBOARD_BASE
  const parts: CrumbPart[] = [{ href: base, label: "Dashboard" }]
  if (!pathname?.startsWith(base) || pathname === base) return parts

  const pathMap = buildPathMap(INSTITUTION_NAV_GROUPS)
  const relative = pathname.slice(base.length).replace(/^\//, "")
  const segments = relative.split("/").filter(Boolean)
  if (segments.length === 0) return parts

  let bestMatch: { href: string; label: string; group: NavGroup } | null = null
  for (const [href, meta] of pathMap) {
    if (pathname === href || pathname.startsWith(href + "/")) {
      if (!bestMatch || href.length > navHrefPath(bestMatch.href).length) {
        bestMatch = { href, ...meta }
      }
    }
  }
  if (bestMatch) {
    parts.push({ href: "#", label: bestMatch.group.title, groupId: bestMatch.group.id })
  }

  let href = base
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (/^\d+$/.test(seg)) continue
    href += `/${seg}`
    const match = pathMap.get(href)
    const isLast = i === segments.length - 1
    if (match || isLast) {
      parts.push({
        href: match ? href : "#",
        label: match ? match.label : getLabelForSegment(seg),
        nonNavigable: !match,
      })
    }
  }

  return parts
}

function getVisibleParts(parts: CrumbPart[]) {
  if (parts.length <= 4) return parts.map((part, index) => ({ part, index, collapsed: false }))
  return [
    { part: parts[0], index: 0, collapsed: false },
    { part: { href: "#", label: "…" }, index: -1, collapsed: true },
    ...parts.slice(-2).map((part, i) => ({
      part,
      index: parts.length - 2 + i,
      collapsed: false,
    })),
  ]
}

const CURRENT_CHIP = "bg-[var(--cc-accent)] !text-white border-0 shadow-sm"

function BreadcrumbChip({
  part,
  isLast,
  isFirst,
  isGroup,
  isCollapsed,
  groupIcons,
}: {
  part: CrumbPart
  isLast: boolean
  isFirst: boolean
  isGroup: boolean
  isCollapsed?: boolean
  groupIcons: Record<string, LucideIcon>
}) {
  const pathname = usePathname()
  const GroupIcon = part.groupId ? groupIcons[part.groupId] : null
  const chipClass = cn(
    "inline-flex max-w-[10rem] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-200 sm:max-w-[14rem] sm:text-sm",
    isCollapsed && "text-[var(--cc-text-muted)]",
    isLast && CURRENT_CHIP,
    !isLast && !isCollapsed && !isGroup && "text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--cc-text)]",
    !isLast && isGroup && "border border-[var(--border)] bg-[var(--muted)] text-[var(--cc-text-secondary)]",
  )
  const content = (
    <>
      {isFirst ? (
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-md",
            isLast ? "bg-white/20" : "bg-[var(--muted)]",
          )}
        >
          <LayoutDashboard className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
        </span>
      ) : GroupIcon ? (
        <GroupIcon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      ) : null}
      <span className="truncate">{part.label}</span>
    </>
  )

  if (isCollapsed) {
    return (
      <span className={chipClass} aria-hidden>
        …
      </span>
    )
  }
  if (isLast || isGroup || part.nonNavigable) {
    return (
      <span className={chipClass} aria-current={isLast ? "page" : undefined}>
        {content}
      </span>
    )
  }
  return (
    <Link href={part.href} className={chipClass} aria-current={part.href === pathname ? "page" : undefined}>
      {content}
    </Link>
  )
}

export function InstitutionBreadcrumbs() {
  const pathname = usePathname() || INSTITUTION_DASHBOARD_BASE
  const parts = getBreadcrumbParts(pathname)
  if (parts.length <= 1) return null

  const groupIcons: Record<string, LucideIcon> = Object.fromEntries(
    INSTITUTION_NAV_GROUPS.map((group) => [group.id, group.icon]),
  )
  groupIcons.dashboard = INSTITUTION_DASHBOARD_LINK.icon ?? LayoutDashboard

  const mobileVisible = getVisibleParts(parts)
  const desktopVisible = parts.map((part, index) => ({ part, index, collapsed: false }))

  return (
    <nav aria-label="Breadcrumb" className="mb-3 sm:mb-5">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl sm:rounded-2xl",
          "border border-[var(--border)]",
          "bg-[var(--card)]/95 backdrop-blur-xl",
          "shadow-[0_2px_12px_rgba(15,23,42,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.25)]",
          "px-2.5 py-2 sm:px-3 sm:py-2.5",
        )}
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[var(--card)] to-transparent sm:hidden"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[var(--card)] to-transparent sm:hidden"
          aria-hidden
        />
        <ol className="flex items-center gap-1 overflow-x-auto scrollbar-none sm:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mobileVisible.map(({ part, index, collapsed }, i) => {
            const isLast = i === mobileVisible.length - 1
            const isGroup = part.href === "#" && part.label !== "…"
            return (
              <li key={`m-${part.href}-${index}-${i}`} className="flex shrink-0 items-center gap-1">
                {i > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--cc-text-muted)]" aria-hidden /> : null}
                <BreadcrumbChip
                  part={part}
                  isLast={isLast}
                  isFirst={i === 0 && !collapsed}
                  isGroup={isGroup}
                  isCollapsed={collapsed}
                  groupIcons={groupIcons}
                />
              </li>
            )
          })}
        </ol>
        <ol className="hidden flex-wrap items-center gap-1.5 sm:flex">
          {desktopVisible.map(({ part, index }, i) => {
            const isLast = i === desktopVisible.length - 1
            const isGroup = part.href === "#"
            return (
              <li key={`d-${part.href}-${index}`} className="flex items-center gap-1.5">
                {i > 0 ? <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)]" aria-hidden /> : null}
                <BreadcrumbChip
                  part={part}
                  isLast={isLast}
                  isFirst={i === 0}
                  isGroup={isGroup}
                  groupIcons={groupIcons}
                />
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
