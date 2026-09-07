import { getStudentModuleTheme } from "@/lib/student-module-themes"

/** Learning Center group accent — shared by web + native notetaker UI */
export const notetakerTheme = getStudentModuleTheme("ai-notetaker")

export const notetakerText = "text-[var(--cc-text)]"
export const notetakerTextMuted = "text-[var(--cc-text-muted)]"
export const notetakerBorder = "border-[var(--border)]"
export const notetakerCardBg = "bg-[var(--card)]"
export const notetakerSoftBg = "bg-[var(--sidebar-accent)]/25"
export const notetakerHoverRow = "hover:bg-[var(--sidebar-accent)]/30"
