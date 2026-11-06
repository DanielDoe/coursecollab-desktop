/**
 * Breadcrumb segments that only exist as parents of dynamic `[id]` routes (no index page).
 * Linking to `/…/module` or `/…/training` without an id returns 404 in Next.js App Router.
 */
export const DYNAMIC_ROUTE_PARENT_SEGMENTS = new Set([
  "module",
  "training",
  "thread",
  "workspace",
  "grade",
])

export function isNonNavigableBreadcrumbPath(href: string, base: string): boolean {
  if (!href || href === "#" || !href.startsWith(base)) return false
  const relative = href.slice(base.length).replace(/^\//, "")
  const segments = relative.split("/").filter(Boolean)
  const last = segments[segments.length - 1]
  return DYNAMIC_ROUTE_PARENT_SEGMENTS.has(last)
}

/** Parent list for a project workspace or graded report. */
export function projectsModuleHomeHref(href: string): string | null {
  if (href.includes("/projects/workspace")) return "/student/dashboard-v2/projects"
  if (href.includes("/projects/grade")) return "/student/dashboard-v2/projects"
  return null
}
