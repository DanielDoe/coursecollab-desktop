"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronRight,
  FilePenLine,
  LayoutDashboard,
  Mail,
  Settings,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { guestBreadcrumbClass } from "@/lib/guest-module-themes"
import { guestBreadcrumbLabel, GUEST_DASHBOARD_HREF } from "@/lib/guest/guest-nav"
import { useGuestDashboard } from "./GuestDashboardContext"

type CrumbPart = { href: string; label: string; groupId?: string; nonNavigable?: boolean }

const GROUP_LABELS: Record<string, string> = {
  recommendations: "Recommendations",
  "cora-career": "Cora Career",
  communication: "Communication",
  account: "Account",
}

const GROUP_ICONS: Record<string, LucideIcon> = {
  recommendations: FilePenLine,
  "cora-career": Sparkles,
  communication: Mail,
  account: User,
}

const SEGMENT_TO_GROUP: Record<string, string> = {
  recommendations: "recommendations",
  "cora-career": "cora-career",
  career: "cora-career",
  "cora-credits": "cora-career",
  match: "cora-career",
  "quick-scan": "cora-career",
  "cover-letter": "cora-career",
  applications: "cora-career",
  chat: "cora-career",
  messages: "communication",
  "report-bug": "communication",
  help: "communication",
  "submit-ticket": "communication",
  "feature-requests": "communication",
  profile: "account",
  settings: "account",
  membership: "account",
}

function getGuestBreadcrumbParts(pathname: string): CrumbPart[] {
  if (!pathname?.startsWith("/guest")) return [{ href: GUEST_DASHBOARD_HREF, label: "Dashboard" }]

  const segments = pathname.split("/").filter(Boolean)
  if (segments[0] !== "guest") return [{ href: GUEST_DASHBOARD_HREF, label: "Dashboard" }]

  const relative = segments.slice(1)
  if (relative.length === 0) return [{ href: GUEST_DASHBOARD_HREF, label: "Dashboard" }]

  const parts: CrumbPart[] = [{ href: GUEST_DASHBOARD_HREF, label: "Dashboard" }]
  const firstSegment = relative[0]!
  const groupId = SEGMENT_TO_GROUP[firstSegment]
  const groupLabel = groupId ? GROUP_LABELS[groupId] ?? groupId : null
  // When the first segment's own label matches its group label (e.g. /guest/recommendations),
  // merge them into one navigable chip instead of rendering "Recommendations > Recommendations".
  const groupAbsorbsFirstSegment =
    groupLabel != null && groupLabel === guestBreadcrumbLabel(firstSegment)

  if (groupId && groupLabel) {
    parts.push({
      href: groupAbsorbsFirstSegment ? `/guest/${firstSegment}` : "#",
      label: groupLabel,
      groupId,
      nonNavigable: !groupAbsorbsFirstSegment,
    })
  }

  let acc = "/guest"
  for (let i = 0; i < relative.length; i++) {
    const seg = relative[i]!
    acc += `/${seg}`
    if (i === 0 && groupAbsorbsFirstSegment) continue
    const prev = i > 0 ? relative[i - 1]! : ""

    let label = guestBreadcrumbLabel(seg)
    if (prev === "recommendations" && /^\d+$/.test(seg)) {
      label = `Request #${seg}`
    } else if (/^\d+$/.test(seg)) {
      label = `#${seg}`
    }

    parts.push({ href: acc, label })
  }

  return parts
}

function getVisibleParts(parts: CrumbPart[]) {
  if (parts.length <= 4) return parts.map((part, index) => ({ part, index, collapsed: false }))

  const first = { part: parts[0]!, index: 0, collapsed: false }
  const tail = parts.slice(-2).map((part, i) => ({
    part,
    index: parts.length - 2 + i,
    collapsed: false,
  }))

  return [
    first,
    { part: { href: "#", label: "…" }, index: -1, collapsed: true },
    ...tail,
  ]
}

function BreadcrumbChip({
  part,
  isLast,
  isFirst,
  isGroup,
  isCollapsed,
}: {
  part: CrumbPart
  isLast: boolean
  isFirst: boolean
  isGroup: boolean
  isCollapsed?: boolean
}) {
  const isStatic = isLast || isGroup || part.nonNavigable
  const GroupIcon = part.groupId ? GROUP_ICONS[part.groupId] : null

  const chipClass = cn(
    "inline-flex max-w-[10rem] sm:max-w-[14rem] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs sm:text-sm font-medium transition-all duration-200",
    isCollapsed && "text-[var(--cc-text-muted)]",
    isLast && guestBreadcrumbClass(),
    !isLast &&
      !isCollapsed &&
      !isGroup &&
      "text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--cc-text)]",
    !isLast &&
      isGroup &&
      "bg-[var(--muted)] text-[var(--cc-text-secondary)] border border-[var(--border)]",
  )

  const content = (
    <>
      {isFirst ? (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-[var(--muted)]">
          <LayoutDashboard className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
        </span>
      ) : GroupIcon ? (
        <GroupIcon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      ) : part.label === "Settings" ? (
        <Settings className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
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

  if (isStatic) {
    return (
      <span className={chipClass} aria-current={isLast ? "page" : undefined}>
        {content}
      </span>
    )
  }

  return (
    <Link href={part.href} className={chipClass}>
      {content}
    </Link>
  )
}

export function GuestBreadcrumbs() {
  const pathname = usePathname() ?? ""
  const { coraImmersive } = useGuestDashboard()
  const parts = getGuestBreadcrumbParts(pathname)

  if (coraImmersive || pathname === GUEST_DASHBOARD_HREF || parts.length <= 1) return null

  const mobileVisible = getVisibleParts(parts)
  const desktopVisible = parts.map((part, index) => ({ part, index, collapsed: false }))

  return (
    <nav aria-label="Breadcrumb" data-native-hide className="mb-3 sm:mb-5">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl sm:rounded-2xl",
          "bg-[var(--card)]/95 backdrop-blur-xl",
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

        <ol className="flex sm:hidden items-center gap-1 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mobileVisible.map(({ part, index, collapsed }, i) => {
            const isLast = i === mobileVisible.length - 1
            const isFirst = i === 0
            const isGroup =
              (part.href === "#" && part.label !== "…" && !part.nonNavigable) || part.groupId != null

            return (
              <li key={`m-${part.href}-${index}-${i}`} className="flex shrink-0 items-center gap-1">
                {i > 0 ? (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--cc-text-muted)]" aria-hidden />
                ) : null}
                <BreadcrumbChip
                  part={part}
                  isLast={isLast}
                  isFirst={isFirst && !collapsed}
                  isGroup={isGroup}
                  isCollapsed={collapsed}
                />
              </li>
            )
          })}
        </ol>

        <ol className="hidden sm:flex flex-wrap items-center gap-1.5">
          {desktopVisible.map(({ part, index }, i) => {
            const isLast = i === desktopVisible.length - 1
            const isFirst = i === 0
            const isGroup = part.href === "#" && (part.groupId != null || !part.nonNavigable)

            return (
              <li key={`d-${part.href}-${index}`} className="flex items-center gap-1.5">
                {i > 0 ? (
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)]" aria-hidden />
                ) : null}
                <BreadcrumbChip
                  part={part}
                  isLast={isLast}
                  isFirst={isFirst}
                  isGroup={isGroup}
                />
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
