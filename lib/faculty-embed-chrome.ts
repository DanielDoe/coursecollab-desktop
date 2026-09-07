import { getFacultyModuleTheme, type FacultyModuleThemeTokens } from "@/lib/faculty-module-themes"
import {
  portalOutlineButtonClass,
  portalAccentIconClass,
  portalViewOrganizerActiveClass,
  portalViewOrganizerContainerClass,
  portalViewOrganizerInactiveClass,
  portalSwitchCheckedClass,
  portalSliderClass,
} from "@/lib/portal-module-themes"
import {
  PORTAL_CARD,
  PORTAL_SOLID_DANGER,
  PORTAL_SOLID_QUIET,
  PORTAL_SOLID_SUCCESS,
  PORTAL_SOLID_THEME,
  PORTAL_SOLID_WARNING,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/appearance/portal-nav-classes"

/** Module-scoped chrome tokens for faculty dashboard embeds. */
export function facultyEmbedChrome(moduleId: string) {
  const theme = getFacultyModuleTheme(moduleId)
  const p = theme.page
  return {
    theme,
    p,
    card: PORTAL_CARD,
    text: PORTAL_TEXT,
    textMuted: PORTAL_TEXT_MUTED,
    cta: PORTAL_SOLID_THEME,
    solid: PORTAL_SOLID_THEME,
    quiet: PORTAL_SOLID_QUIET,
    success: PORTAL_SOLID_SUCCESS,
    danger: PORTAL_SOLID_DANGER,
    warning: PORTAL_SOLID_WARNING,
    outline: portalOutlineButtonClass(theme),
    iconBadge: (size: "sm" | "md" = "md") =>
      `${size === "sm" ? "size-10 rounded-xl" : "size-12 rounded-2xl"} flex items-center justify-center bg-[var(--cc-accent)] !text-white`,
    accentIcon: portalAccentIconClass(theme),
    viewOrganizer: {
      container: portalViewOrganizerContainerClass(),
      active: portalViewOrganizerActiveClass(theme),
      inactive: portalViewOrganizerInactiveClass(),
    },
    switchChecked: portalSwitchCheckedClass(theme),
    slider: portalSliderClass(theme),
  } as const
}

export type FacultyEmbedChrome = ReturnType<typeof facultyEmbedChrome>
export type { FacultyModuleThemeTokens }
