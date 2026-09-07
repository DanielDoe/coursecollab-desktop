/**
 * Instructor navigation — course delivery IA (see instructor-portal-nav-config.ts).
 */

import {
  INSTRUCTOR_DASHBOARD_LINK,
  INSTRUCTOR_NAV_GROUPS,
  isInstructorGroupActive,
  isInstructorItemActive,
} from "@/lib/instructor-portal-nav-config"

export type { NavItem, NavGroup } from "@/lib/portal-nav-config"

export { INSTRUCTOR_DASHBOARD_LINK, INSTRUCTOR_NAV_GROUPS }

export const DASHBOARD_LINK = INSTRUCTOR_DASHBOARD_LINK

export function isGroupActive(group: (typeof INSTRUCTOR_NAV_GROUPS)[number], pathname: string): boolean {
  return isInstructorGroupActive(group, pathname)
}

export function isItemActive(
  item: (typeof INSTRUCTOR_NAV_GROUPS)[number]["items"][number],
  pathname: string,
): boolean {
  return isInstructorItemActive(item, pathname)
}
