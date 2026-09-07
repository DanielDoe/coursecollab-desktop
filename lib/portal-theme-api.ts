/**
 * Unified portal theme API — pick the portal, then group/module helpers.
 */

import { getGuestPortalTheme, getGuestSidebarTheme } from "./guest-module-themes"
import {
  getFacultyNavGroupTheme,
  getFacultySidebarThemeForGroup,
  getFacultyModuleTheme,
  getFacultyModuleThemeFromPath,
} from "./faculty-module-themes"
import {
  getSummerCampModuleTheme,
  getSummerCampNavGroupTheme,
  getSummerCampSidebarThemeForGroup,
} from "./summer-camp-module-themes"
import {
  getStudentModuleTheme,
  getStudentModuleThemeFromPath,
  getStudentNavGroupTheme,
  getSidebarThemeForNavGroup,
  studentModuleBreadcrumbClass,
  studentModuleIconBadgeClass,
  studentModuleSpinnerClass,
  studentModuleTabActiveClass,
} from "./student-module-themes"
import type { PortalModuleThemeTokens, PortalSidebarTheme } from "./portal-module-themes"

export type PortalId = "student" | "faculty" | "guest" | "summer-camp"

export function getPortalNavGroupTheme(
  portal: PortalId,
  groupId: string
): PortalModuleThemeTokens {
  switch (portal) {
    case "faculty":
      return getFacultyNavGroupTheme(groupId)
    case "summer-camp":
      return getSummerCampNavGroupTheme(groupId)
    case "guest":
      return getGuestPortalTheme()
    case "student":
    default:
      return getStudentNavGroupTheme(groupId)
  }
}

export function getPortalSidebarThemeForGroup(
  portal: PortalId,
  groupId: string
): PortalSidebarTheme {
  switch (portal) {
    case "faculty":
      return getFacultySidebarThemeForGroup(groupId)
    case "summer-camp":
      return getSummerCampSidebarThemeForGroup(groupId)
    case "guest":
      return getGuestSidebarTheme()
    case "student":
    default:
      return getSidebarThemeForNavGroup(groupId)
  }
}

export function getPortalModuleTheme(
  portal: PortalId,
  moduleId: string
): PortalModuleThemeTokens {
  switch (portal) {
    case "faculty":
      return getFacultyModuleTheme(moduleId)
    case "summer-camp":
      return getSummerCampModuleTheme(moduleId)
    case "guest":
      return getGuestPortalTheme()
    case "student":
    default:
      return getStudentModuleTheme(moduleId)
  }
}

/** Re-export portal-specific helpers for direct imports */
export {
  getStudentModuleTheme,
  getStudentModuleThemeFromPath,
  getStudentNavGroupTheme,
  getSidebarThemeForNavGroup,
  studentModuleBreadcrumbClass,
  studentModuleIconBadgeClass,
  studentModuleSpinnerClass,
  studentModuleTabActiveClass,
  getFacultyNavGroupTheme,
  getFacultySidebarThemeForGroup,
  getFacultyModuleTheme,
  getFacultyModuleThemeFromPath,
  getSummerCampModuleTheme,
  getSummerCampNavGroupTheme,
  getSummerCampSidebarThemeForGroup,
  getGuestPortalTheme,
  getGuestSidebarTheme,
  guestBreadcrumbClass,
}

export type { PortalModuleThemeTokens, PortalSidebarTheme, PortalColorFamily } from "./portal-module-themes"
export {
  portalViewOrganizerContainerClass,
  portalViewOrganizerActiveClass,
  portalViewOrganizerInactiveClass,
  portalAccentIconClass,
  portalStatusBadgeClass,
  portalOutlineButtonClass,
  portalSelectedOutlineClass,
  portalProgressFillClass,
  portalIconBadgeClass,
} from "./portal-module-themes"
