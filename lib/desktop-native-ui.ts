/** Shared desktop-shell surfaces. Web layouts must not import these as defaults. */

export const DESKTOP_SURFACE =
  "rounded-[8px] border border-[#e5e7eb] bg-white shadow-none dark:border-[#262626] dark:bg-[#171717]"

export const DESKTOP_PANEL_PAD = "p-3"

export const DESKTOP_SECTION_TITLE =
  "text-[13px] font-semibold tracking-tight text-[#111827] dark:text-[#f3f4f6]"

export const DESKTOP_SECTION_META = "text-[12px] leading-4 text-[#6b7280] dark:text-[#9ca3af]"

export const DESKTOP_SECTION_LINK = "text-[12px] font-medium text-[#2563eb] hover:underline"

export const DESKTOP_KPI_CARD =
  "h-[88px] rounded-[8px] border border-[#e5e7eb] bg-white p-3 shadow-none hover:bg-[#f9fafb] dark:border-[#262626] dark:bg-[#171717] dark:hover:bg-[#1a1a1a]"

export const DESKTOP_ROW =
  "rounded-[6px] px-2 py-1.5 transition-colors hover:bg-[#f3f4f6] dark:hover:bg-[#1a1a1a]"

export const DESKTOP_BTN =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"

export const DESKTOP_BTN_GHOST =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-[#6b7280] hover:bg-[#f3f4f6] dark:hover:bg-[#1a1a1a]"

export const DESKTOP_BTN_OUTLINE =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-[#e5e7eb] bg-white px-3 text-[12px] font-medium text-[#374151] hover:bg-[#f9fafb] disabled:pointer-events-none disabled:opacity-40 dark:border-[#262626] dark:bg-[#171717] dark:text-[#d1d5db] dark:hover:bg-[#1a1a1a]"

export const DESKTOP_ICON_BTN =
  "inline-flex size-8 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#f3f4f6] dark:hover:bg-[#1a1a1a]"

export const DESKTOP_SELECT =
  "h-10 shrink-0 !rounded-full border-[var(--border)] bg-[var(--muted)]/40 px-3 py-0 text-[13px] shadow-none"

export const DESKTOP_SEGMENTED =
  "flex h-10 shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--muted)]/40 p-1"

export const DESKTOP_CHIP =
  "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-[#374151] hover:bg-[#f9fafb] dark:text-[#d1d5db] dark:hover:bg-[#1a1a1a]"
