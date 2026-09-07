/** Instructor dashboard v2 navigation - used by Sidebar and Topbar search */

import { INSTRUCTOR_NAV_GROUPS } from "./instructor-nav-config"

export type InstructorNavModule = {
  id: string
  label: string
  href: string
  group: string
}

import { DASHBOARD_LINK } from "./instructor-nav-config"

/** Flatten grouped nav for search - preserves all routes */
export const INSTRUCTOR_DASHBOARD_V2_MODULES: InstructorNavModule[] = [
  { id: DASHBOARD_LINK.id, label: DASHBOARD_LINK.label, href: DASHBOARD_LINK.href, group: "Main" },
  ...INSTRUCTOR_NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => ({
      id: item.id,
      label: item.label,
      href: item.href,
      group: group.title,
    }))
  ),
]

export function searchInstructorModules(query: string): InstructorNavModule[] {
  const q = query.trim().toLowerCase()
  if (!q) return INSTRUCTOR_DASHBOARD_V2_MODULES
  return INSTRUCTOR_DASHBOARD_V2_MODULES.filter(
    (m) =>
      m.label.toLowerCase().includes(q) ||
      m.group.toLowerCase().includes(q)
  )
}
