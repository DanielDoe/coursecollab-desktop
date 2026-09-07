import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import {
  PORTAL_CARD,
  PORTAL_CTA,
  PORTAL_OUTLINE_BTN,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/appearance/portal-nav-classes"

export { PORTAL_CARD, PORTAL_CTA, PORTAL_OUTLINE_BTN, PORTAL_TEXT, PORTAL_TEXT_MUTED }

/** Shared appearance tokens for student dashboard-v2 module pages */
export function studentEmbedTheme(moduleId: string) {
  const page = getStudentModuleTheme(moduleId).page
  return {
    page,
    panel: cn("rounded-2xl border shadow-sm", PORTAL_CARD),
    softPanel: cn("rounded-xl border", page.softBg, page.border),
    iconWell: cn("border shrink-0", page.iconBg, page.border),
    iconWellLg: cn("rounded-2xl border shrink-0", page.iconBg, page.border),
    progress: "bg-[var(--muted)] [&_[data-slot=progress-indicator]]:!bg-[var(--cc-accent)]",
    accentText: page.iconText,
    accent: {
      ring: "ring-[var(--cc-accent-border)]",
      pinnedBg: cn("border-0 shadow-none", page.softBg, page.iconText),
      titleHover: "group-hover:text-[var(--cc-accent-dark)]",
      btn: PORTAL_CTA,
      unreadRing: "ring-[var(--cc-accent)]/45",
      reactionActive: cn("ring-[var(--cc-accent-border)]", page.softBg),
    },
  }
}

export const APPEARANCE_TEXT = PORTAL_TEXT
export const APPEARANCE_TEXT_MUTED = PORTAL_TEXT_MUTED
export const APPEARANCE_BORDER = "border-[var(--border)]"
export const APPEARANCE_CARD = "bg-[var(--card)]"
export const APPEARANCE_MUTED_BG = "bg-[var(--muted)]"

export {
  EMBED_CARD,
  EMBED_SEARCH,
  EMBED_TOOLBAR_ICON,
  EMBED_TOOLBAR_ICON_ACTIVE,
  EMBED_INNER_PANEL,
  EMBED_LIST,
  EMBED_LIST_TILE,
  EMBED_LIST_TILE_ACTIVE,
  EMBED_LIST_TILE_UNREAD,
  EmbedModuleCard,
  EmbedSearchField,
  EmbedToolbar,
  EmbedToolbarActions,
  EmbedListTile,
} from "@/components/student/dashboard-v2/embed-module-ui"
