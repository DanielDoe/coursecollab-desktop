/**
 * Shared dashboard-v2 spacing — aligned with question bank (compact card body).
 * Shell + CardWrapper inner body; avoid extra px/py inside embed components when embedded.
 */

/** `<main>` padding around breadcrumbs + page (both instructor & student). */
export const dashboardV2ShellMainClass = "p-3 sm:p-4 md:p-5 lg:p-5"

/** Motion / page root inside a route — shrink-0 so flex `main` scrolls instead of clipping overflow-hidden cards. */
export const dashboardV2PageRootClass = "w-full min-w-0 shrink-0 overflow-x-hidden"

/**
 * Dashboard module scroll modes (merged shell):
 * - `page` (default): content grows naturally; `<main>` scrolls (forms, evaluation, syllabus, …).
 * - `panel`: module fills the viewport; split panes scroll internally (messages, quizzes, calendar, …).
 */
export type DashboardV2ModuleScrollMode = "page" | "panel"

/** Set on panel-mode page roots — merged `<main>` uses this to disable page scroll. */
export const DASHBOARD_V2_PANEL_SCROLL_ATTR = "data-scroll-mode"

/** Wrapper classes for StudentDashboardModulePage / hub shells. */
export function dashboardV2ModuleShellClass(mode: DashboardV2ModuleScrollMode = "page") {
  return mode === "panel"
    ? "flex min-h-0 w-full min-w-0 flex-1 flex-col"
    : "w-full min-w-0 shrink-0"
}

/** Inner padding inside CardWrapper (one layer only). */
export const dashboardV2CardBodyClass =
  "p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden"

/** Standalone legacy pages (non–dashboard-v2) that mirror the same density. */
export const dashboardV2StandalonePageClass =
  "w-full max-w-[min(100%,72rem)] mx-auto px-3 sm:px-4 md:px-5 py-3 sm:py-4 min-w-0 overflow-x-hidden"

/** Lesson / module viewers — scales up on large screens without feeling cramped. */
export const dashboardV2LessonContentClass =
  "mx-auto w-full min-w-0 max-w-[min(100%,80rem)]"

/** Vertical stack between sections on home / settings-style pages. */
export const dashboardV2PageStackClass = "space-y-4 sm:space-y-5 md:space-y-6"

/** Breadcrumb spacing below topbar. */
export const dashboardV2BreadcrumbMarginClass = "mb-4 sm:mb-5"

/** Faculty/instructor lecture PDF preview (`…/content/lectures/:id`). */
export function isInstructorLecturePreviewPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return /\/content\/lectures\/\d+$/.test(pathname)
}

/** Faculty assessment student-view preview (`…/assessments/{type}/:id/preview`). */
export function isInstructorAssessmentPreviewPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return /\/assessments\/(?:quizzes|homework|mid-semester|finals)\/\d+\/preview$/.test(pathname)
}

export function isInstructorImmersivePreviewPath(pathname: string | null | undefined): boolean {
  return isInstructorLecturePreviewPath(pathname) || isInstructorAssessmentPreviewPath(pathname)
}

/** Student lecture viewer (`…/lectures/:week`, not content management). */
export function isStudentLectureViewerPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return /\/lectures\/\d+$/.test(pathname) && !pathname.includes("/content/lectures/")
}

/** Summer camp module viewer (`…/summer-camp/module/:id`). */
export function isStudentSummerCampModulePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return /\/summer-camp\/module\/\d+/.test(pathname)
}

export function normalizeDashboardPath(path: string): string {
  const trimmed = path.replace(/\/$/, "")
  return trimmed || "/"
}

/** True when pathname is a dashboard home/landing route (sidebar stays expanded). */
export function isDashboardV2LandingPath(
  pathname: string | null | undefined,
  landingPaths: string[],
): boolean {
  if (!pathname) return false
  const current = normalizeDashboardPath(pathname)
  return landingPaths.some((p) => current === normalizeDashboardPath(p))
}
