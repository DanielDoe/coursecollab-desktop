/** Appearance-aware shell classes shared across guest, student, faculty, and admin portals. */

export const portalShellRoot = "min-h-screen bg-[var(--cc-background)] text-[var(--cc-text)] antialiased"
export const portalHeader =
  "sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]/85 backdrop-blur-2xl shadow-sm"
export const portalHeaderInner = "mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5"
export const portalBrandLink =
  "flex items-center gap-3 min-w-0 rounded-2xl -m-1 p-1 pr-3 sm:pr-4 hover:bg-[var(--sidebar-accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
export const portalBrandIconWell =
  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--cc-accent-soft)] border border-[var(--cc-accent-border)]"
export const portalBrandIcon = "h-[1.35rem] w-[1.35rem] text-[var(--cc-accent-dark)]"
export const portalBrandTitle = "text-[15px] sm:text-base font-bold tracking-tight text-[var(--cc-text)] leading-tight"
export const portalBrandEyebrow =
  "text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)] mt-0.5"
export const portalNavLink =
  "inline-flex items-center justify-center gap-2 rounded-full px-3.5 py-2.5 sm:py-2 text-sm font-medium border border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)] hover:bg-[var(--sidebar-accent)] transition-colors"
export const portalNavLinkActive =
  "border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
export const portalCta =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 sm:py-2 text-sm font-semibold bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] text-white shadow-sm transition-[filter,transform] active:scale-[0.98]"
export const portalIconButton =
  "inline-flex items-center justify-center rounded-full size-11 sm:size-10 shrink-0 text-[var(--cc-text-secondary)] hover:text-[var(--cc-text)] hover:bg-[var(--sidebar-accent)] border border-transparent hover:border-[var(--border)] transition-colors"
export const portalMain = "mx-auto max-w-6xl px-3 sm:px-6 lg:px-8 py-5 sm:py-8 pb-[max(1.25rem,env(safe-area-inset-bottom))] w-full min-w-0"
export const portalCard = "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 shadow-sm"
export const portalTitle = "text-lg font-bold text-[var(--cc-text)]"
export const portalSubtitle = "text-sm text-[var(--cc-text-muted)]"
export const portalDropdown =
  "absolute right-0 mt-2 w-64 rounded-2xl bg-[var(--popover)]/95 backdrop-blur-2xl border border-[var(--border)] shadow-xl py-2 overflow-hidden z-50"
export const portalDropdownItem =
  "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--cc-text-secondary)] hover:bg-[var(--sidebar-accent)] transition-colors rounded-xl mx-2"
export const portalInput =
  "rounded-xl border-[var(--border)] bg-[var(--background)] text-[var(--cc-text)]"
export const portalLabel = "text-sm font-medium text-[var(--cc-text-secondary)]"
