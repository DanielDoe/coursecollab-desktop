/**
 * Faculty / instructor dashboard v2 — nav group accent colors.
 * @see lib/portal-module-themes.ts for shared token definitions
 */

import {
  type PortalColorFamily,
  type PortalModuleThemeTokens,
  type PortalSidebarTheme,
  themeFromSemantic,
  PORTAL_DEFAULT_FAMILY,
} from "./portal-module-themes"
import {
  NAV_GROUP_SEMANTIC_ROLE,
  resolveGroupedModuleSemanticRole,
} from "@/lib/appearance/module-semantic-map"
import { ccPageSpinnerClass } from "@/lib/appearance/ui-primitives"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"

export const FACULTY_MODULE_TO_NAV_GROUP: Record<string, string> = {
  dashboard: "dashboard",
  sections: "course",
  calendar: "course",
  announcements: "course",
  syllabus: "course",
  lectures: "course",
  practice: "course",
  flashcards: "course",
  "course-notes": "course",
  playground: "course",
  codebench: "course",
  "cora-copilot": "course",
  groups: "course",
  projects: "course",
  "course-exchange": "course",
  "summer-camp": "course",
  quizzes: "assessments",
  "question-bank": "assessments",
  homeworks: "assessments",
  "mid-semester": "assessments",
  "final-exams": "assessments",
  "classroom-points": "assessments",
  "course-evaluations": "assessments",
  attendance: "assessments",
  grades: "assessments",
  "student-mgmt": "students",
  campers: "students",
  "office-hours": "students",
  recommendations: "students",
  "trade-center": "students",
  results: "analytics",
  "advanced-analytics": "analytics",
  reports: "analytics",
  "progress-reviews": "analytics",
  "cora-insights": "analytics",
  "ai-monitoring": "analytics",
  "ai-insights": "analytics",
  notifications: "communication",
  messages: "communication",
  discussions: "communication",
  "help-center": "communication",
  "course-settings": "course-administration",
  "assessment-governance": "course-administration",
  "assessment-defaults": "course-administration",
  "my-courses": "course",
  "grading-policies": "course-administration",
  "attendance-policies": "course-administration",
  "classroom-points-rules": "course-administration",
  "practice-rules": "course-administration",
  "playground-rules": "course-administration",
  "ai-assistant-settings": "course-administration",
  "team-project-policies": "course-administration",
  "submission-issues": "course-administration",
  "teaching-assistants": "course-administration",
  profile: "settings",
  settings: "settings",
  membership: "settings",
}

const FACULTY_PATH_PREFIX_TO_MODULE: Array<{ prefix: string; moduleId: string }> = [
  { prefix: `${FACULTY_DASHBOARD_BASE}/assessments/quizzes/question-bank`, moduleId: "question-bank" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/assessments/course-evaluations`, moduleId: "course-evaluations" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/assessments/classroom-points`, moduleId: "classroom-points" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/assessments/mid-semester`, moduleId: "mid-semester" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/assessments/finals`, moduleId: "final-exams" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/assessments/homework`, moduleId: "homeworks" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/assessments/attendance`, moduleId: "attendance" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/assessments/grades`, moduleId: "grades" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/assessments/quizzes`, moduleId: "quizzes" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/analytics/advanced`, moduleId: "advanced-analytics" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/analytics/reports`, moduleId: "reports" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/analytics/progress-reviews`, moduleId: "progress-reviews" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/analytics/cora-insights`, moduleId: "cora-insights" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/analytics/ai-monitoring`, moduleId: "cora-insights" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/analytics/ai-insights`, moduleId: "cora-insights" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/communication/announcements`, moduleId: "announcements" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/communication/notifications`, moduleId: "notifications" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/communication/messages`, moduleId: "messages" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/communication/discussions`, moduleId: "discussions" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/administration/course-settings`, moduleId: "course-settings" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/administration/my-courses`, moduleId: "my-courses" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/administration/teaching-assistants`, moduleId: "teaching-assistants" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/administration`, moduleId: "course-settings" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/calendar`, moduleId: "calendar" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/management/sessions`, moduleId: "sections" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/management/students`, moduleId: "student-mgmt" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/management/groups`, moduleId: "groups" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/management/projects`, moduleId: "projects" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/content/syllabus`, moduleId: "syllabus" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/content/lectures`, moduleId: "lectures" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/content/practice`, moduleId: "practice" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/content/flashcards`, moduleId: "flashcards" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/content/notes`, moduleId: "course-notes" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/course/exchange`, moduleId: "course-exchange" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/course/playground`, moduleId: "playground" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/codebench`, moduleId: "codebench" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/cora`, moduleId: "cora-copilot" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/learning-center/office-hours`, moduleId: "office-hours" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/learning-center/help`, moduleId: "help-center" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/students/trade-center`, moduleId: "trade-center" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/recommendations`, moduleId: "recommendations" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/summer-camp`, moduleId: "summer-camp" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/campers`, moduleId: "campers" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/results`, moduleId: "results" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/settings/profile`, moduleId: "profile" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/membership`, moduleId: "membership" },
  { prefix: `${FACULTY_DASHBOARD_BASE}/settings`, moduleId: "settings" },
  { prefix: FACULTY_DASHBOARD_BASE, moduleId: "dashboard" },
].sort((a, b) => b.prefix.length - a.prefix.length)

export function getFacultyModuleTheme(moduleId: string): FacultyModuleThemeTokens {
  const groupId = FACULTY_MODULE_TO_NAV_GROUP[moduleId] ?? "dashboard"
  const family = FACULTY_NAV_GROUP_FAMILY[groupId] ?? DEFAULT_FAMILY
  const role = resolveGroupedModuleSemanticRole(moduleId, groupId)
  return themeFromSemantic(role, family)
}

export function getFacultyModuleThemeFromPath(pathname: string): FacultyModuleThemeTokens {
  const match = FACULTY_PATH_PREFIX_TO_MODULE.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  return getFacultyModuleTheme(match?.moduleId ?? "dashboard")
}

export function facultyModuleIconBadgeClass(moduleId: string, size: "sm" | "md" = "md"): string {
  const t = getFacultyModuleTheme(moduleId)
  const sizeClass = size === "sm" ? "size-10 rounded-xl" : "size-12 rounded-2xl"
  return `${sizeClass} flex items-center justify-center ${t.page.iconBg} ${t.page.iconText}`
}

export function facultyModuleTabActiveClass(moduleId: string): string {
  return getFacultyModuleTheme(moduleId).page.tabActive
}

export function facultyModuleSpinnerClass(moduleId: string): string {
  const groupId = FACULTY_MODULE_TO_NAV_GROUP[moduleId] ?? "dashboard"
  const role = resolveGroupedModuleSemanticRole(moduleId, groupId)
  return ccPageSpinnerClass(role)
}

export type FacultyModuleColorFamily = PortalColorFamily
export type FacultyModuleThemeTokens = PortalModuleThemeTokens
export type FacultySidebarTheme = PortalSidebarTheme

const DEFAULT_FAMILY: PortalColorFamily = "emerald"

/** One accent per sidebar accordion group */
export const FACULTY_NAV_GROUP_FAMILY: Record<string, PortalColorFamily> = {
  dashboard: "emerald",
  course: "blue",
  "course-support": "blue",
  assessments: "indigo",
  students: "teal",
  instructors: "indigo",
  users: "teal",
  academic: "sky",
  finance: "emerald",
  system: "amber",
  analytics: "orange",
  communication: "violet",
  administration: "amber",
  "course-administration": "amber",
  settings: "slate",
}

export function getFacultyNavGroupTheme(groupId: string): FacultyModuleThemeTokens {
  const family = FACULTY_NAV_GROUP_FAMILY[groupId] ?? DEFAULT_FAMILY
  const role = NAV_GROUP_SEMANTIC_ROLE[groupId] ?? "primary"
  return themeFromSemantic(role, family)
}

export function getFacultySidebarThemeForGroup(groupId: string): FacultySidebarTheme {
  return getFacultyNavGroupTheme(groupId).sidebar
}

export function getFacultyPortalDefaultTheme(): FacultyModuleThemeTokens {
  return themeFromSemantic("primary", PORTAL_DEFAULT_FAMILY)
}

export function facultyModuleBreadcrumbClass(_groupId?: string): string {
  return "bg-[var(--cc-accent)] !text-white border-0 shadow-sm"
}
