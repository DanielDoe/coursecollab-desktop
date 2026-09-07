import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { facultyToolbarFilterButtonClass } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import {
  PORTAL_CARD,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/appearance/portal-nav-classes"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { cn } from "@/lib/utils"

export type AnalyticsHubSection =
  | "reports"
  | "results"
  | "progress-reviews"
  | "student-progress"

export const ANALYTICS_HUB_MODULE = "advanced-analytics"

export function analyticsChrome(moduleId: string = ANALYTICS_HUB_MODULE) {
  return facultyEmbedChrome(moduleId)
}

export const AN_SPINNER = facultyModuleSpinnerClass(ANALYTICS_HUB_MODULE)

export const AN_PANEL = cn(PORTAL_CARD, "overflow-hidden shadow-sm")

export const AN_PANEL_INNER = "p-4 sm:p-5"

export const AN_TITLE = cn("text-base font-semibold", PORTAL_TEXT)

export const AN_DESC = cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)

export const AN_META = cn("text-xs", PORTAL_TEXT_MUTED)

export const AN_INPUT = cn("h-10 rounded-lg shadow-none", CC_FIELD.base, CC_FIELD.focus)

export const AN_STAT_INSET = "rounded-lg bg-[var(--sidebar-accent)]/40 p-3"

export const AN_DIVIDER = "border-[var(--sidebar-border)]"

export function anCtaClass(moduleId?: string) {
  return analyticsChrome(moduleId).cta
}

export function anOutlineClass(moduleId?: string) {
  return analyticsChrome(moduleId).outline
}

export function anFilterBtn(active?: boolean) {
  return cn(facultyToolbarFilterButtonClass(active), "shadow-none")
}

export { PORTAL_TEXT, PORTAL_TEXT_MUTED }
