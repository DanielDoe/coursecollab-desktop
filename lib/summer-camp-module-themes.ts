/**
 * Summer camp portal (camper nav inside student dashboard-v2).
 * @see lib/portal-module-themes.ts
 */

import {
  type PortalColorFamily,
  type PortalModuleThemeTokens,
  type PortalSidebarTheme,
  themeFromFamily,
} from "./portal-module-themes"

export type SummerCampModuleThemeTokens = PortalModuleThemeTokens
export type SummerCampSidebarTheme = PortalSidebarTheme

const DEFAULT_FAMILY: PortalColorFamily = "amber"

export const SUMMER_CAMP_NAV_GROUP_FAMILY: Record<string, PortalColorFamily> = {
  "summer-camp": "amber",
  "camp-extras": "sky",
}

export const CAMP_MODULE_TO_NAV_GROUP: Record<string, string> = {
  "camp-dashboard": "summer-camp",
  "my-trainings": "summer-camp",
  "browse-trainings": "summer-camp",
  "learning-roadmap": "summer-camp",
  "camp-projects": "summer-camp",
  checkpoints: "summer-camp",
  "discussions-help": "summer-camp",
  "camp-messages": "summer-camp",
  resources: "summer-camp",
  gallery: "summer-camp",
  graduation: "summer-camp",
  "camp-leaderboard": "summer-camp",
  achievements: "summer-camp",
  "camp-calendar": "camp-extras",
  "camp-announcements": "camp-extras",
  "camp-support": "camp-extras",
}

export function getSummerCampNavGroupTheme(groupId: string): SummerCampModuleThemeTokens {
  return themeFromFamily(SUMMER_CAMP_NAV_GROUP_FAMILY[groupId] ?? DEFAULT_FAMILY)
}

export function getSummerCampSidebarThemeForGroup(groupId: string): SummerCampSidebarTheme {
  return getSummerCampNavGroupTheme(groupId).sidebar
}

export function getSummerCampModuleTheme(moduleId: string): SummerCampModuleThemeTokens {
  const groupId = CAMP_MODULE_TO_NAV_GROUP[moduleId]
  if (groupId && SUMMER_CAMP_NAV_GROUP_FAMILY[groupId]) {
    return themeFromFamily(SUMMER_CAMP_NAV_GROUP_FAMILY[groupId])
  }
  return themeFromFamily(DEFAULT_FAMILY)
}

/** Longest-prefix wins for camper dashboard routes */
export const CAMP_PATH_PREFIX_TO_MODULE: Array<{ prefix: string; moduleId: string }> = [
  { prefix: "/student/dashboard-v2/summer-camp/training", moduleId: "my-trainings" },
  { prefix: "/student/dashboard-v2/summer-camp/module", moduleId: "learning-roadmap" },
  { prefix: "/student/dashboard-v2/summer-camp/my-trainings", moduleId: "my-trainings" },
  { prefix: "/student/dashboard-v2/summer-camp/browse", moduleId: "browse-trainings" },
  { prefix: "/student/dashboard-v2/summer-camp/roadmap", moduleId: "learning-roadmap" },
  { prefix: "/student/dashboard-v2/summer-camp/projects", moduleId: "camp-projects" },
  { prefix: "/student/dashboard-v2/summer-camp/checkpoints", moduleId: "checkpoints" },
  { prefix: "/student/dashboard-v2/summer-camp/discussions", moduleId: "discussions-help" },
  { prefix: "/student/dashboard-v2/summer-camp/messages", moduleId: "camp-messages" },
  { prefix: "/student/dashboard-v2/summer-camp/resources", moduleId: "resources" },
  { prefix: "/student/dashboard-v2/summer-camp/gallery", moduleId: "gallery" },
  { prefix: "/student/dashboard-v2/summer-camp/graduation", moduleId: "graduation" },
  { prefix: "/student/dashboard-v2/summer-camp/leaderboard", moduleId: "camp-leaderboard" },
  { prefix: "/student/dashboard-v2/summer-camp/achievements", moduleId: "achievements" },
  { prefix: "/student/dashboard-v2/summer-camp/calendar", moduleId: "camp-calendar" },
  { prefix: "/student/dashboard-v2/summer-camp/announcements", moduleId: "camp-announcements" },
  { prefix: "/student/dashboard-v2/summer-camp/support", moduleId: "camp-support" },
  { prefix: "/student/dashboard-v2/summer-camp/onboarding", moduleId: "camp-dashboard" },
  { prefix: "/student/dashboard-v2/summer-camp", moduleId: "camp-dashboard" },
].sort((a, b) => b.prefix.length - a.prefix.length)

export function getSummerCampModuleThemeFromPath(pathname: string): SummerCampModuleThemeTokens {
  const match = CAMP_PATH_PREFIX_TO_MODULE.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  return getSummerCampModuleTheme(match?.moduleId ?? "camp-dashboard")
}

export function summerCampBreadcrumbClass(pathname: string): string {
  const t = getSummerCampModuleThemeFromPath(pathname)
  return `${t.page.softBg} ${t.page.iconText} border ${t.page.border} shadow-sm`
}

/** Map URL segment under /summer-camp/ → module id for breadcrumbs */
export const CAMP_SEGMENT_TO_MODULE: Record<string, string> = {
  "my-trainings": "my-trainings",
  browse: "browse-trainings",
  roadmap: "learning-roadmap",
  projects: "camp-projects",
  checkpoints: "checkpoints",
  discussions: "discussions-help",
  messages: "camp-messages",
  resources: "resources",
  gallery: "gallery",
  graduation: "graduation",
  leaderboard: "camp-leaderboard",
  achievements: "achievements",
  calendar: "camp-calendar",
  announcements: "camp-announcements",
  support: "camp-support",
  training: "my-trainings",
  module: "learning-roadmap",
}
