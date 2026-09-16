"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ChevronRight,
  BookOpen,
  ClipboardList,
  Users,
  Trophy,
  GraduationCap,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { studentModuleBreadcrumbClass } from "@/lib/student-module-themes"
import { isNonNavigableBreadcrumbPath } from "@/lib/breadcrumb-navigability"
import { SUMMER_CAMP_DASHBOARD_BASE } from "@/lib/summer-camp/camper-nav"
import {
  CAMP_MODULE_TO_NAV_GROUP,
  CAMP_SEGMENT_TO_MODULE,
} from "@/lib/summer-camp-module-themes"
import { useDashboardV2 } from "./DashboardV2Context"
import { CORA_NAV_LABEL } from "@/lib/cora/constants"

const SEGMENT_LABELS: Record<string, string> = {
  "dashboard-v2": "Dashboard",
  lectures: "Lectures",
  "ai-notetaker": "AI Notetaker",
  practice: "Practice Hub",
  "ai-tutor": CORA_NAV_LABEL,
  "cora-credits": "Cora Credits",
  codebench: "CodeBench",
  ide: "Editor",
  more: "Analytics & More",
  quizzes: "Quizzes",
  "quiz-history": "History",
  homework: "Homework",
  "mid-semester-exams": "Mid-Semester Exams",
  "final-exams": "Final Exams",
  grades: "Grades",
  forum: "Forum Hub",
  groups: "Groups",
  projects: "Projects",
  playground: "Playground",
  leaderboard: "Leaderboard",
  "classroom-points": "Classroom Points",
  attendance: "Attendance",
  "trade-center": "Trade Center",
  announcements: "Announcements",
  syllabus: "Syllabus",
  "course-evaluation": "Course Evaluation",
  calendar: "Calendar",
  "schedule-adjustment": "Schedule Adjustment",
  timeline: "Semester Timeline",
  "office-hours": "Office Hours",
  recommendations: "Recommendation Letters",
  request: "New request",
  "help-center": "Help Center",
  help: "Help Center",
  membership: "Membership",
  "summer-camp": "Summer Camp",
  training: "Training",
  module: "Module",
  gallery: "Showcase Gallery",
  graduation: "Graduation",
  roadmap: "Roadmap",
  "submit-ticket": "Submit Ticket",
  "report-bug": "Report Bug",
  "feature-requests": "Feature Requests",
  settings: "Settings",
  appearance: "Appearance",
  "my-trainings": "My Trainings",
  browse: "Browse Trainings",
  checkpoints: "Checkpoints & Submissions",
  achievements: "Certificates & Achievements",
  resources: "Resources",
  discussions: "Discussions & Help",
  onboarding: "Camp Onboarding",
  programs: "Programs",
  new: "New lecture",
}

const GROUP_LABELS: Record<string, string> = {
  "learning-center": "Learning Center",
  assessments: "Assessments",
  collaboration: "Collaboration",
  "performance-rewards": "Performance & Rewards",
  "course-info": "Course Info",
  support: "Support",
  "summer-camp": "Summer Camp",
  "camp-extras": "Camp Info",
}

const GROUP_ICONS: Record<string, LucideIcon> = {
  "learning-center": BookOpen,
  assessments: ClipboardList,
  collaboration: Users,
  "performance-rewards": Trophy,
  "course-info": GraduationCap,
  support: LifeBuoy,
}

const SEGMENT_TO_GROUP: Record<string, string> = {
  lectures: "learning-center",
  "ai-notetaker": "learning-center",
  practice: "learning-center",
  "ai-tutor": "learning-center",
  "cora-credits": "support",
  codebench: "learning-center",
  quizzes: "assessments",
  "quiz-history": "assessments",
  homework: "assessments",
  "mid-semester-exams": "assessments",
  "final-exams": "assessments",
  grades: "assessments",
  forum: "collaboration",
  groups: "collaboration",
  projects: "collaboration",
  playground: "collaboration",
  "classroom-points": "performance-rewards",
  attendance: "performance-rewards",
  "trade-center": "performance-rewards",
  announcements: "course-info",
  "course-evaluation": "course-info",
  calendar: "course-info",
  "schedule-adjustment": "course-info",
  timeline: "course-info",
  "office-hours": "course-info",
  recommendations: "course-info",
  help: "support",
  "help-center": "support",
  membership: "support",
  "submit-ticket": "support",
  "report-bug": "support",
  "feature-requests": "support",
}

function prettifyNotetakerSegment(seg: string): string {
  const core = seg.replace(/-(\d+)$/, "").replace(/-/g, " ").trim()
  const body = core || seg.replace(/-/g, " ")
  return body.replace(/\b\w/g, (c) => c.toUpperCase())
}

type CrumbPart = { href: string; label: string; groupId?: string; nonNavigable?: boolean }

function getBreadcrumbParts(
  pathname: string,
  aiNotetakerDetailLabel: string | null,
  campModuleDetailLabel: string | null,
): CrumbPart[] {
  const base = "/student/dashboard-v2"
  if (!pathname?.startsWith(base)) return [{ href: base, label: "Dashboard" }]

  const relative = pathname.slice(base.length).replace(/^\//, "")
  const segments = relative ? relative.split("/").filter(Boolean) : []

  const dashboardHref =
    segments[0] === "summer-camp" ? SUMMER_CAMP_DASHBOARD_BASE : base

  const parts: CrumbPart[] = [{ href: dashboardHref, label: "Dashboard" }]

  if (segments.length === 0) return parts

  const firstSegment = segments[0]
  if (firstSegment === "summer-camp") {
    const campSeg = segments[1]
    const moduleId = (campSeg && CAMP_SEGMENT_TO_MODULE[campSeg]) || "camp-dashboard"
    const groupId = CAMP_MODULE_TO_NAV_GROUP[moduleId] ?? "summer-camp"
    parts.push({
      href: "#",
      label: GROUP_LABELS[groupId] || "Summer Camp",
      groupId,
    })
  } else {
    const groupId = SEGMENT_TO_GROUP[firstSegment]
    if (groupId && firstSegment !== "codebench") {
      parts.push({ href: "#", label: GROUP_LABELS[groupId] || groupId, groupId })
    } else if (firstSegment === "codebench") {
      parts.push({
        href: "#",
        label: GROUP_LABELS["learning-center"] || "Learning Center",
        groupId: "learning-center",
      })
    }
  }

  let href = base
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    href += `/${seg}`
    const prev = i > 0 ? segments[i - 1] : ""
    let label = SEGMENT_LABELS[seg]

    if (prev === "module" && /^\d+$/.test(seg)) {
      label = campModuleDetailLabel?.trim() || "Lesson"
    } else if (!label) {
      if (prev === "ai-notetaker" && seg !== "new") {
        const fromContext = aiNotetakerDetailLabel?.trim()
        if (fromContext) {
          label = fromContext.length > 56 ? `${fromContext.slice(0, 55)}…` : fromContext
        } else if (/^\d+$/.test(seg)) {
          label = "Lecture"
        } else {
          label = seg.length > 48 ? "Lecture" : prettifyNotetakerSegment(seg)
        }
      } else if (prev === "training" && /^\d+$/.test(seg)) {
        label = "Training"
      } else if (prev === "recommendations" && /^\d+$/.test(seg)) {
        label = `Request #${seg}`
      } else if (prev === "schedule-adjustment" && /^\d+$/.test(seg)) {
        label = "Details"
      } else if (/^\d+$/.test(seg)) {
        label = campModuleDetailLabel?.trim() || "Lesson"
      } else {
        label = seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      }
    }
    const nonNavigable = isNonNavigableBreadcrumbPath(href, base)
    parts.push({ href: nonNavigable ? "#" : href, label, nonNavigable })
  }

  return parts
}

/** Collapse middle crumbs on narrow screens when trail is long */
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
  pathname,
}: {
  part: CrumbPart
  isLast: boolean
  isFirst: boolean
  isGroup: boolean
  isCollapsed?: boolean
  pathname: string
}) {
  const isStatic = isLast || isGroup || part.nonNavigable
  const GroupIcon = part.groupId ? GROUP_ICONS[part.groupId] : null

  const chipClass = cn(
    "inline-flex max-w-[10rem] sm:max-w-[14rem] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs sm:text-sm font-medium transition-all duration-200",
    isCollapsed && "text-[var(--cc-text-muted)]",
    isLast && studentModuleBreadcrumbClass(pathname),
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

export function DashboardBreadcrumbs({ compact }: { compact?: boolean }) {
  const pathname = usePathname()
  const { aiNotetakerBreadcrumbTitle, campModuleBreadcrumbTitle } = useDashboardV2()
  const parts = getBreadcrumbParts(pathname || "", aiNotetakerBreadcrumbTitle, campModuleBreadcrumbTitle)

  if (parts.length <= 1) return null

  const mobileVisible = getVisibleParts(parts)
  const desktopVisible = parts.map((part, index) => ({ part, index, collapsed: false }))

  return (
    <>
      <nav
        aria-label="Breadcrumb"
        data-native-hide
        className={cn("mb-3 sm:mb-5", compact && "mb-3")}
      >
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

          {/* Mobile: collapsed trail */}
          <ol className="flex sm:hidden items-center gap-1 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {mobileVisible.map(({ part, index, collapsed }, i) => {
              const isLast = i === mobileVisible.length - 1
              const isFirst = i === 0
              const isGroup =
                (part.href === "#" && part.label !== "…" && !part.nonNavigable) || part.groupId != null

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
                    pathname={pathname || ""}
                  />
                </li>
              )
            })}
          </ol>

          {/* Desktop: full trail */}
          <ol className="hidden sm:flex flex-wrap items-center gap-1.5">
            {desktopVisible.map(({ part, index }, i) => {
              const isLast = i === desktopVisible.length - 1
              const isFirst = i === 0
              const isGroup = part.href === "#" && (part.groupId != null || !part.nonNavigable)

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
                    pathname={pathname || ""}
                  />
                </li>
              )
            })}
          </ol>
        </div>
      </nav>
    </>
  )
}
