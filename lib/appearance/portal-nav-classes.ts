/** Shared secondary / in-page nav link classes — matches dashboard sidebar drawer tokens. */

export const PORTAL_NAV_LINK_IDLE =
  "text-[var(--cc-drawer-label-secondary)] hover:bg-[var(--cc-drawer-nav-hover-bg)] hover:text-[var(--cc-drawer-label)]"
export const PORTAL_NAV_LINK_ACTIVE =
  "bg-[var(--cc-drawer-nav-active-bg)] text-[var(--cc-drawer-primary)] border border-[var(--cc-drawer-nav-active-border)] shadow-sm"
export const PORTAL_NAV_ICON_IDLE =
  "bg-[var(--cc-drawer-icon-well-bg)] text-[var(--cc-drawer-label-secondary)]"
export const PORTAL_NAV_ICON_ACTIVE =
  "bg-[var(--pv-sidebar-active-icon-bg)] text-[var(--cc-drawer-primary)]"

export const PORTAL_CTA =
  "bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] !text-white border-0 shadow-sm"
/** Solid actions that follow the active Appearance theme (Apple Lavender, Ocean, …). */
export const PORTAL_SOLID_THEME = PORTAL_CTA
export const PORTAL_SOLID_SUCCESS =
  "bg-[var(--cc-success)] !text-white hover:opacity-90 border-0 shadow-sm"
export const PORTAL_SOLID_DANGER =
  "bg-[var(--cc-danger)] !text-white hover:opacity-90 border-0 shadow-sm"
export const PORTAL_SOLID_WARNING =
  "bg-[var(--cc-warning)] !text-white hover:opacity-90 border-0 shadow-sm"
export const PORTAL_SOLID_QUIET =
  "bg-[var(--muted)] !text-[var(--cc-text)] hover:bg-[var(--cc-accent-soft)] border border-[var(--border)] shadow-none"
export const PORTAL_OUTLINE_BTN =
  "border border-[var(--cc-accent-border)] bg-[var(--card)] text-[var(--cc-accent-dark)] hover:bg-[var(--cc-accent-soft)] hover:text-[var(--cc-accent-dark)]"
export const PORTAL_MUTED_BTN =
  "border border-[var(--border)] bg-[var(--muted)] text-[var(--cc-text-muted)] opacity-80 cursor-not-allowed"
export const PORTAL_TEXT = "text-[var(--cc-text)]"
export const PORTAL_TEXT_MUTED = "text-[var(--cc-text-muted)]"
/** List rows in faculty/student embeds — accent tint, not flat gray muted. */
export const PORTAL_LIST_ROW_HOVER = "hover:bg-[var(--cc-accent-soft)]/45"
export const PORTAL_CARD =
  "rounded-2xl border border-[var(--border)] bg-[var(--card)]"
export const PORTAL_NOTIFICATION_BADGE =
  "bg-[var(--cc-sem-danger)] text-white ring-2 ring-[var(--card)] shadow-sm"
export const PORTAL_NOTIFICATION_BADGE_ALT =
  "bg-[var(--cc-sem-danger-hover)] text-white ring-2 ring-[var(--card)] shadow-sm"
