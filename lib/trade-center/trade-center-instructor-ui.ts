import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { facultyToolbarFilterButtonClass } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import {
  PORTAL_CARD,
  PORTAL_CTA,
  PORTAL_OUTLINE_BTN,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/appearance/portal-nav-classes"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { cn } from "@/lib/utils"

export const TC_MODULE_ID = "trade-center"

export const TC_CHART = {
  primary: "var(--cc-sem-reward)",
  secondary: "var(--cc-sem-warning)",
  muted: "rgb(100 116 139)",
} as const

export const TC_TABS_LIST =
  "inline-flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-[var(--sidebar-accent)]/35 p-1 sm:w-auto border-0 shadow-none"

export const TC_TABS_TRIGGER =
  "rounded-lg px-3 py-2 text-xs sm:text-sm data-[state=active]:bg-[var(--sidebar-accent)] data-[state=active]:text-[var(--cc-accent-dark)] data-[state=active]:shadow-none"

export const TC_STAT_INSET = "rounded-lg bg-[var(--sidebar-accent)]/40 p-3"

export const TC_DIVIDER = "border-[var(--sidebar-border)]"

export function tcChrome() {
  return facultyEmbedChrome(TC_MODULE_ID)
}

export const TC_SPINNER = facultyModuleSpinnerClass(TC_MODULE_ID)

export const TC_PANEL = cn(PORTAL_CARD, "overflow-hidden shadow-sm")

export const TC_PANEL_INNER = "p-4 sm:p-5"

export const TC_TITLE = cn("text-base font-semibold", PORTAL_TEXT)

export const TC_DESC = cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)

export const TC_META = cn("text-xs", PORTAL_TEXT_MUTED)

export const TC_KPI = cn(TC_PANEL, "p-4 sm:p-5")

export const TC_INPUT = cn("h-10 rounded-lg shadow-none", CC_FIELD.base, CC_FIELD.focus)

export const TC_TABLE_WRAP = cn(TC_PANEL, "overflow-x-auto")

export const TC_EMPTY = cn(TC_PANEL, "p-8 sm:p-10 text-center")

export const TC_ROW_HOVER = "hover:bg-[var(--cc-accent-soft)]/45"

export function tcSwitchClass() {
  return tcChrome().switchChecked
}

export function tcSliderClass() {
  return tcChrome().slider
}

export function tcCtaClass() {
  return tcChrome().cta
}

export function tcOutlineClass() {
  return tcChrome().outline
}

export function tcIconBadge(size: "sm" | "md" = "sm") {
  return tcChrome().iconBadge(size)
}

export function tcFilterBtn(active?: boolean) {
  return cn(facultyToolbarFilterButtonClass(active), "shadow-none")
}

export { PORTAL_CTA, PORTAL_TEXT, PORTAL_TEXT_MUTED }
