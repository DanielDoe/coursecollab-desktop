"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { LayoutDashboard, ChevronRight, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { NavGroup } from "@/lib/portal-nav-config"
import { isNonNavigableBreadcrumbPath } from "@/lib/breadcrumb-navigability"
import { facultyModuleBreadcrumbClass } from "@/lib/faculty-module-themes"
import { useInstructorDashboardV2 } from "./InstructorDashboardV2Context"

/** Build flat path -> item map from nav config */
function buildPathMap(navGroups: NavGroup[]): Map<string, { label: string; group: NavGroup }> {
  const map = new Map<string, { label: string; group: NavGroup }>()
  for (const group of navGroups) {
    for (const item of group.items) {
      map.set(item.href, { label: item.label, group })
    }
  }
  return map
}

/** Extra segment labels for nested routes not in nav */
const SEGMENT_LABELS: Record<string, string> = {
  "question-bank": "Question Bank",
  deleted: "Deleted",
  issues: "Issues",
  advanced: "Advanced Analytics",
  reports: "Reports",
  "progress-reviews": "Progress Reviews",
  "cora-insights": "Cora Insights",
  codebench: "CodeBench",
  workspace: "My Workspace",
  library: "Code Library",
  "ai-monitoring": "Cora Insights",
  "ai-insights": "Cora Insights",
  profile: "Profile",
  help: "Help Center",
  settings: "Settings",
  membership: "Instructor Plans",
  checkout: "Checkout",
  success: "Confirmation",
  cancel: "Checkout",
  "course-settings": "Course Settings",
  "assessment-governance": "Assessment Governance",
  "grading-policies": "Grading Policies",
  "attendance-policies": "Attendance Policies",
  "classroom-points-rules": "Classroom Points Rules",
  "practice-rules": "Practice Hub Rules",
  "playground-rules": "Playground Rules",
  "ai-assistant-settings": "Cora Assistant Settings",
  "team-project-policies": "Team & Project Policies",
  "submission-issues": "Submission Issues",
  "submission-diagnostics": "Submission Issues",
  announcements: "Announcements",
  syllabus: "Syllabus",
  calendar: "Calendar",
  notifications: "Notifications",
  "office-hours": "Office Hours",
  "trade-center": "Trade Center",
  quizzes: "Manage Quizzes",
  homeworks: "Manage Homework",
  "mid-semester": "Mid-Semester Exams",
  finals: "Final Exams",
  grades: "Grades Management",
  "classroom-points": "Classroom Points",
  "course-evaluations": "Course Evaluations",
  attendance: "Attendance",
  lectures: "Manage Lectures",
  practice: "Manage Practice",
  playground: "Manage Playground",
  sessions: "Academic Sessions",
  groups: "Manage Groups",
  projects: "Manage Projects",
  students: "Student Management",
  instructors: "Instructor & TA Management",
  results: "Manage Results",
  content: "Content",
  management: "Management",
  assessments: "Assessments",
  communication: "Communication",
  administration: "Administration",
  "learning-center": "Learning Center",
  course: "Course",
  analytics: "Analytics",
  "student-progress": "Class Analytics",
  recommendations: "Recommendation Letters",
  discussions: "Course Discussions",
  "teaching-assistants": "Teaching Assistants",
  "ta-permissions": "Teaching Assistants",
  "course-support": "Course Support",
  "summer-camp": "Summer Camp",
  training: "Training",
  certificates: "Certificates",
}

function getLabelForSegment(seg: string): string {
  return SEGMENT_LABELS[seg] ?? seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

type CrumbPart = { href: string; label: string; groupId?: string; nonNavigable?: boolean }

const ANALYTICS_HUB_SUB_LABELS: Record<string, Record<string, string>> = {
  reports: { templates: "Templates", generated: "Generated" },
  "student-progress": {
    overview: "Overview",
    performance: "Performance",
    students: "Students",
    assessments: "Assessments",
    trends: "Trends",
    "ai-tutor": "AI Tutor",
  },
}

function navHrefPath(href: string): string {
  return href.split("?")[0] ?? href
}

function findAnalyticsHubNavItem(
  pathMap: Map<string, { label: string; group: NavGroup }>,
  hubPath: string,
  section: string,
) {
  for (const [href, meta] of pathMap) {
    if (navHrefPath(href) !== hubPath) continue
    const itemSection = new URLSearchParams(href.split("?")[1] ?? "").get("section")
    if (itemSection === section) return { href, ...meta }
  }
  return null
}

function getAnalyticsHubBreadcrumbParts(
  base: string,
  pathMap: Map<string, { label: string; group: NavGroup }>,
  currentSearch: string,
): CrumbPart[] {
  const hubPath = `${base}/analytics`
  const params = new URLSearchParams(currentSearch)
  let section = params.get("section")
  if (section === "analytics") section = "student-progress"
  if (!section) section = "results"

  const itemMatch = findAnalyticsHubNavItem(pathMap, hubPath, section)
  const analyticsGroup =
    itemMatch?.group ??
    [...pathMap.entries()].find(([href]) => navHrefPath(href) === hubPath)?.[1]?.group
  const groupId = analyticsGroup?.id ?? "analytics"
  const groupTitle = analyticsGroup?.title ?? "Analytics"

  const parts: CrumbPart[] = [
    { href: base, label: "Dashboard" },
    { href: "#", label: groupTitle, groupId },
  ]

  if (itemMatch) {
    parts.push({
      href: itemMatch.href,
      label: itemMatch.label,
      nonNavigable: isNonNavigableBreadcrumbPath(itemMatch.href, base),
    })
  } else {
    parts.push({
      href: `${hubPath}?section=${section}`,
      label: getLabelForSegment(section),
    })
  }

  const sub = params.get("sub")
  const subLabel = sub ? ANALYTICS_HUB_SUB_LABELS[section]?.[sub] : undefined
  if (subLabel) {
    parts.push({ href: "#", label: subLabel, nonNavigable: true })
  }

  return parts
}

function getBreadcrumbParts(
  pathname: string,
  base: string,
  pathMap: Map<string, { label: string; group: NavGroup }>,
  currentSearch = "",
): CrumbPart[] {
  const hubPath = `${base}/analytics`
  if (pathname === hubPath) {
    return getAnalyticsHubBreadcrumbParts(base, pathMap, currentSearch)
  }

  if (!pathname?.startsWith(base)) return [{ href: base, label: "Dashboard" }]

  const parts: CrumbPart[] = [{ href: base, label: "Dashboard" }]

  const relative = pathname.slice(base.length).replace(/^\//, "")
  const segments = relative ? relative.split("/").filter(Boolean) : []

  if (segments.length === 0) return parts

  let bestMatch: { href: string; label: string; group: NavGroup } | null = null
  for (const [href, { label, group }] of pathMap) {
    const itemPath = navHrefPath(href)
    if (pathname === itemPath || pathname.startsWith(itemPath + "/")) {
      if (!bestMatch || itemPath.length > navHrefPath(bestMatch.href).length) {
        bestMatch = { href, label, group }
      }
    }
  }

  if (bestMatch) {
    parts.push({ href: "#", label: bestMatch.group.title, groupId: bestMatch.group.id })
  }

  let href = base
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (seg === "training" && /^\d+$/.test(segments[i + 1] ?? "")) {
      href += `/training/${segments[i + 1]}`
      i += 1
      parts.push({ href: "#", label: "Training", nonNavigable: true })
      continue
    }
    if (/^\d+$/.test(seg)) continue
    href += `/${seg}`
    const match = pathMap.get(href)
    const isLast = i === segments.length - 1
    if (match || isLast) {
      const label = match ? match.label : getLabelForSegment(seg)
      const linkHref = match ? href : "#"
      const nonNavigable =
        linkHref !== "#" && isNonNavigableBreadcrumbPath(linkHref, base)
      parts.push({
        href: nonNavigable ? "#" : linkHref,
        label,
        nonNavigable,
      })
    }
  }

  const params = new URLSearchParams(currentSearch)
  if (pathname.endsWith("/schedule-adjustment") && (params.get("id") || params.get("new") === "1")) {
    const listHref = pathname
    const lastCrumb = parts[parts.length - 1]
    if (lastCrumb) {
      lastCrumb.href = listHref
      lastCrumb.nonNavigable = false
    }
    parts.push({
      href: "#",
      label: params.get("new") === "1" ? "New request" : "Details",
      nonNavigable: true,
    })
  }

  return parts
}

function getVisibleParts(parts: CrumbPart[]) {
  if (parts.length <= 4) return parts.map((part, index) => ({ part, index, collapsed: false }))

  const first = { part: parts[0], index: 0, collapsed: false }
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
  groupIcons,
  activeGroupId,
}: {
  part: CrumbPart
  isLast: boolean
  isFirst: boolean
  isGroup: boolean
  isCollapsed?: boolean
  groupIcons: Record<string, LucideIcon>
  activeGroupId: string
}) {
  const pathname = usePathname()
  const GroupIcon = part.groupId ? groupIcons[part.groupId] : null

  const chipClass = cn(
    "inline-flex max-w-[10rem] sm:max-w-[14rem] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs sm:text-sm font-medium transition-all duration-200",
    isCollapsed && "text-[var(--cc-text-muted)]",
    isLast && facultyModuleBreadcrumbClass(activeGroupId),
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
    <Link
      href={part.href}
      className={chipClass}
      onClick={(event) => {
        if (part.href !== pathname) return
        event.preventDefault()
        window.dispatchEvent(new Event("instructor-breadcrumb-module-home"))
      }}
    >
      {content}
    </Link>
  )
}

export function InstructorDashboardBreadcrumbs({ compact }: { compact?: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { basePath, navGroups, pageBreadcrumbTail } = useInstructorDashboardV2()
  const pathMap = buildPathMap(navGroups)
  const groupIcons: Record<string, LucideIcon> = Object.fromEntries(navGroups.map((g) => [g.id, g.icon]))
  let parts = getBreadcrumbParts(pathname || "", basePath, pathMap, searchParams.toString())

  if (pageBreadcrumbTail && parts.length > 0) {
    const moduleIdx = [...parts]
      .map((p, i) => ({ p, i }))
      .reverse()
      .find(({ p }) => !p.groupId && p.label !== "Dashboard")?.i
    if (moduleIdx != null) {
      const currentHref = pathname || parts[moduleIdx].href
      parts[moduleIdx] = {
        ...parts[moduleIdx],
        href: currentHref && currentHref !== "#" ? currentHref : parts[moduleIdx].href,
        nonNavigable: false,
      }
    }
    parts = [...parts, { href: "#", label: pageBreadcrumbTail, nonNavigable: true }]
  }
  const activeGroupId = parts.find((p) => p.groupId)?.groupId ?? "dashboard"
  const isCoraPage = Boolean(pathname?.endsWith("/cora"))

  if (parts.length <= 1) return null

  const mobileVisible = getVisibleParts(parts)
  const desktopVisible = parts.map((part, index) => ({ part, index, collapsed: false }))

  return (
    <nav aria-label="Breadcrumb" className={cn("mb-3 sm:mb-5", compact && "mb-3", isCoraPage && "hidden sm:block")}>
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

        <ol className="flex sm:hidden items-center gap-1 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mobileVisible.map(({ part, index, collapsed }, i) => {
            const isLast = i === mobileVisible.length - 1
            const isFirst = i === 0
            const isGroup = part.href === "#" && part.label !== "…"

            return (
              <li key={`m-${part.href}-${index}-${i}`} className="flex shrink-0 items-center gap-1">
                {i > 0 && (
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0 text-[var(--cc-text-muted)]"
                    aria-hidden
                  />
                )}
                <BreadcrumbChip
                  part={part}
                  isLast={isLast}
                  isFirst={isFirst && !collapsed}
                  isGroup={isGroup}
                  isCollapsed={collapsed}
                  groupIcons={groupIcons}
                  activeGroupId={activeGroupId}
                />
              </li>
            )
          })}
        </ol>

        <ol className="hidden sm:flex flex-wrap items-center gap-1.5">
          {desktopVisible.map(({ part, index }, i) => {
            const isLast = i === desktopVisible.length - 1
            const isFirst = i === 0
            const isGroup = part.href === "#"

            return (
              <li key={`d-${part.href}-${index}`} className="flex items-center gap-1.5">
                {i > 0 && (
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)]"
                    aria-hidden
                  />
                )}
                <BreadcrumbChip
                  part={part}
                  isLast={isLast}
                  isFirst={isFirst}
                  isGroup={isGroup}
                  groupIcons={groupIcons}
                  activeGroupId={activeGroupId}
                />
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
