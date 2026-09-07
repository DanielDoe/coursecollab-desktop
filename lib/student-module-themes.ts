/**
 * Student dashboard v2 — nav group + module accent colors.
 * Shared tokens: lib/portal-module-themes.ts
 */

import {
  type PortalColorFamily,
  type PortalModuleThemeTokens,
  type PortalSidebarTheme,
  themeFromSemantic,
  PORTAL_DEFAULT_FAMILY,
} from './portal-module-themes'
import {
  resolveModuleSemanticRole,
  resolveGroupedModuleSemanticRole,
  NAV_GROUP_SEMANTIC_ROLE,
} from '@/lib/appearance/module-semantic-map'
import { ccPageSpinnerClass } from '@/lib/appearance/ui-primitives'
import {
  SUMMER_CAMP_NAV_GROUP_FAMILY,
  CAMP_MODULE_TO_NAV_GROUP,
  getSummerCampModuleThemeFromPath,
  summerCampBreadcrumbClass,
} from './summer-camp-module-themes'

export type StudentModuleColorFamily = PortalColorFamily
export type StudentModuleThemeTokens = PortalModuleThemeTokens
export type SidebarTheme = PortalSidebarTheme

const DEFAULT_FAMILY = PORTAL_DEFAULT_FAMILY

/** Module id → accent family (matches Sidebar active colors) */
export const STUDENT_MODULE_FAMILY: Record<string, StudentModuleColorFamily> = {
  dashboard: "brand",
  lectures: "sky",
  "ai-notetaker": "violet",
  practice: "amber",
  flashcards: "amber",
  "ai-tutor": "violet",
  codebench: "blue",
  "codebench-more": "blue",
  quizzes: "purple",
  "quiz-history": "indigo",
  homework: "teal",
  "mid-semester-exams": "blue",
  "final-exams": "rose",
  grades: "amber",
  forum: "amber",
  messages: "amber",
  groups: "amber",
  projects: "amber",
  playground: "amber",
  "classroom-points": "rose",
  attendance: "rose",
  "trade-center": "rose",
  announcements: "sky",
  "progress-review": "sky",
  syllabus: "sky",
  "course-evaluation": "sky",
  calendar: "sky",
  "schedule-adjustment": "sky",
  "office-hours": "sky",
  "course-policies": "sky",
  recommendations: "sky",
  membership: "amber",
  "help-center": "slate",
  "submit-ticket": "blue",
  "report-bug": "rose",
  "feature-requests": "violet",
  settings: "brand",
  purchases: "brand",
  "camp-dashboard": "amber",
  "my-trainings": "violet",
  "browse-trainings": "sky",
  "learning-roadmap": "emerald",
  "camp-projects": "orange",
  checkpoints: "purple",
  "discussions-help": "emerald",
  resources: "sky",
  achievements: "amber",
  "camp-calendar": "sky",
  "camp-announcements": "amber",
  "camp-support": "slate",
}

/**
 * Accordion groups share ONE accent across header + all child nav items + page content.
 * Per-module colors in STUDENT_MODULE_FAMILY are fallback only (standalone routes, summer camp).
 */
export const STUDENT_NAV_GROUP_FAMILY: Record<string, StudentModuleColorFamily> = {
  "learning-center": "brand",
  assessments: "teal",
  collaboration: "amber",
  "performance-rewards": "rose",
  "course-info": "sky",
  support: "slate",
}

/** Module id → sidebar accordion group id */
export const MODULE_TO_NAV_GROUP: Record<string, string> = {
  lectures: "learning-center",
  "ai-notetaker": "learning-center",
  practice: "learning-center",
  "ai-tutor": "learning-center",
  codebench: "learning-center",
  "codebench-more": "learning-center",
  quizzes: "assessments",
  "quiz-history": "assessments",
  homework: "assessments",
  "mid-semester-exams": "assessments",
  "final-exams": "assessments",
  grades: "assessments",
  forum: "collaboration",
  messages: "collaboration",
  groups: "collaboration",
  projects: "collaboration",
  playground: "collaboration",
  "classroom-points": "performance-rewards",
  attendance: "performance-rewards",
  "trade-center": "performance-rewards",
  announcements: "course-info",
  "progress-review": "course-info",
  syllabus: "course-info",
  "course-evaluation": "course-info",
  calendar: "course-info",
  "schedule-adjustment": "course-info",
  "office-hours": "course-info",
  "course-policies": "course-info",
  recommendations: "course-info",
  membership: "support",
  "help-center": "support",
  "submit-ticket": "support",
  "report-bug": "support",
  "feature-requests": "support",
}

export function getStudentNavGroupTheme(groupId: string): StudentModuleThemeTokens {
  const family = STUDENT_NAV_GROUP_FAMILY[groupId] ?? SUMMER_CAMP_NAV_GROUP_FAMILY[groupId] ?? DEFAULT_FAMILY
  const role = NAV_GROUP_SEMANTIC_ROLE[groupId] ?? "primary"
  return themeFromSemantic(role, family)
}

export function getSidebarThemeForNavGroup(groupId: string): SidebarTheme {
  return getStudentNavGroupTheme(groupId).sidebar
}

export function studentModuleBreadcrumbClass(pathname: string): string {
  if (pathname.includes("/summer-camp")) {
    return summerCampBreadcrumbClass(pathname)
  }
  const t = getStudentModuleThemeFromPath(pathname)
  return `${t.page.softBg} ${t.page.iconText} border ${t.page.border} shadow-sm`
}

/** Longest-prefix wins — same rule as sidebar active highlighting */
const PATH_PREFIX_TO_MODULE: Array<{ prefix: string; moduleId: string }> = [
  { prefix: "/student/dashboard-v2/codebench/more", moduleId: "codebench-more" },
  { prefix: "/student/dashboard-v2/codebench/ide", moduleId: "codebench" },
  { prefix: "/student/dashboard-v2/course-info/course-evaluation", moduleId: "course-evaluation" },
  { prefix: "/student/dashboard-v2/course-info/policies", moduleId: "course-policies" },
  { prefix: "/student/dashboard-v2/settings/purchases", moduleId: "purchases" },
  { prefix: "/student/dashboard-v2/summer-camp", moduleId: "camp-dashboard" },
  { prefix: "/student/dashboard-v2", moduleId: "dashboard" },
  { prefix: "/student/dashboard-v2/lectures", moduleId: "lectures" },
  { prefix: "/student/dashboard-v2/ai-notetaker", moduleId: "ai-notetaker" },
  { prefix: "/student/dashboard-v2/practice", moduleId: "practice" },
  { prefix: "/student/dashboard-v2/ai-tutor", moduleId: "ai-tutor" },
  { prefix: "/student/dashboard-v2/codebench", moduleId: "codebench" },
  { prefix: "/student/dashboard-v2/quiz-history", moduleId: "quiz-history" },
  { prefix: "/student/dashboard-v2/quizzes", moduleId: "quizzes" },
  { prefix: "/student/dashboard-v2/homework", moduleId: "homework" },
  { prefix: "/student/dashboard-v2/mid-semester-exams", moduleId: "mid-semester-exams" },
  { prefix: "/student/dashboard-v2/final-exams", moduleId: "final-exams" },
  { prefix: "/student/dashboard-v2/grades", moduleId: "grades" },
  { prefix: "/student/dashboard-v2/forum", moduleId: "forum" },
  { prefix: "/student/dashboard-v2/messages", moduleId: "messages" },
  { prefix: "/student/dashboard-v2/groups", moduleId: "groups" },
  { prefix: "/student/dashboard-v2/projects", moduleId: "projects" },
  { prefix: "/student/dashboard-v2/playground", moduleId: "playground" },
  { prefix: "/student/dashboard-v2/classroom-points", moduleId: "classroom-points" },
  { prefix: "/student/dashboard-v2/attendance", moduleId: "attendance" },
  { prefix: "/student/dashboard-v2/trade-center", moduleId: "trade-center" },
  { prefix: "/student/dashboard-v2/announcements", moduleId: "announcements" },
  { prefix: "/student/dashboard-v2/progress-review", moduleId: "progress-review" },
  { prefix: "/student/dashboard-v2/syllabus", moduleId: "syllabus" },
  { prefix: "/student/dashboard-v2/calendar", moduleId: "calendar" },
  { prefix: "/student/dashboard-v2/schedule-adjustment", moduleId: "schedule-adjustment" },
  { prefix: "/student/dashboard-v2/office-hours", moduleId: "office-hours" },
  { prefix: "/student/dashboard-v2/recommendations", moduleId: "recommendations" },
  { prefix: "/student/dashboard-v2/membership", moduleId: "membership" },
  { prefix: "/student/dashboard-v2/help", moduleId: "help-center" },
  { prefix: "/student/dashboard-v2/submit-ticket", moduleId: "submit-ticket" },
  { prefix: "/student/dashboard-v2/report-bug", moduleId: "report-bug" },
  { prefix: "/student/dashboard-v2/feature-requests", moduleId: "feature-requests" },
  { prefix: "/student/dashboard-v2/settings", moduleId: "settings" },
].sort((a, b) => b.prefix.length - a.prefix.length)

export function getStudentModuleTheme(moduleId: string): StudentModuleThemeTokens {
  const groupId = MODULE_TO_NAV_GROUP[moduleId] ?? CAMP_MODULE_TO_NAV_GROUP[moduleId]
  const family =
    STUDENT_MODULE_FAMILY[moduleId] ??
    (groupId ? (STUDENT_NAV_GROUP_FAMILY[groupId] ?? SUMMER_CAMP_NAV_GROUP_FAMILY[groupId]) : undefined) ??
    DEFAULT_FAMILY
  const role = groupId ? resolveGroupedModuleSemanticRole(moduleId, groupId) : resolveModuleSemanticRole(moduleId)
  return themeFromSemantic(role, family)
}

export function getStudentModuleThemeFromPath(pathname: string): StudentModuleThemeTokens {
  if (pathname.includes("/summer-camp")) {
    return getSummerCampModuleThemeFromPath(pathname)
  }
  const match = PATH_PREFIX_TO_MODULE.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
  return getStudentModuleTheme(match?.moduleId ?? "dashboard")
}

export function studentModuleIconBadgeClass(moduleId: string, size: "sm" | "md" = "md"): string {
  const t = getStudentModuleTheme(moduleId)
  const sizeClass = size === "sm" ? "size-10 rounded-xl" : "size-12 rounded-2xl"
  return `${sizeClass} flex items-center justify-center ${t.page.iconBg} ${t.page.iconText}`
}

export function studentModuleTabActiveClass(moduleId: string): string {
  return getStudentModuleTheme(moduleId).page.tabActive
}

export function studentModuleSpinnerClass(moduleId: string): string {
  const groupId = MODULE_TO_NAV_GROUP[moduleId] ?? CAMP_MODULE_TO_NAV_GROUP[moduleId]
  const role = groupId
    ? resolveGroupedModuleSemanticRole(moduleId, groupId)
    : resolveModuleSemanticRole(moduleId)
  return ccPageSpinnerClass(role)
}

export function getSidebarThemeForModule(moduleId: string): SidebarTheme {
  return getStudentModuleTheme(moduleId).sidebar
}

/** Sidebar child links — appearance tokens from module / camp theme. */
export function getSidebarThemeForNavItem(moduleId: string): SidebarTheme {
  return getStudentModuleTheme(moduleId).sidebar
}
