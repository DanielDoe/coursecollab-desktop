"use client"

import { createContext, useContext, type ReactNode } from "react"

/** brand = instructor/legacy primary; portal = student dashboard appearance tokens */
export type SyllabusAccentMode = "brand" | "sky" | "portal"

export type SyllabusAccentClasses = {
  text: string
  textStrong: string
  bgSoft: string
  bgIcon: string
  borderSoft: string
  borderMedium: string
  pillActive: string
  navActive: string
  progress: string
  dot: string
  bulletBefore: string
  calloutBorder: string
  calloutBg: string
  h2Bar: string
  h3Heading: string
  totalRow: string
}

const BRAND_ACCENT: SyllabusAccentClasses = {
  text: "text-primary",
  textStrong: "text-primary font-semibold",
  bgSoft: "bg-primary/10",
  bgIcon: "bg-primary/10 text-primary",
  borderSoft: "border-primary/15",
  borderMedium: "border-primary/30",
  pillActive: "border-primary bg-primary/10 text-primary",
  navActive: "bg-primary/10 font-medium text-primary",
  progress: "bg-primary/70",
  dot: "bg-primary/60",
  bulletBefore: "before:bg-primary/60",
  calloutBorder: "border-primary/15",
  calloutBg: "bg-primary/5",
  h2Bar: "bg-primary/70",
  h3Heading: "text-primary",
  totalRow: "border-primary/30 bg-primary/5",
}

/** Follows global appearance settings (--cc-accent*) on student dashboard */
const PORTAL_ACCENT: SyllabusAccentClasses = {
  text: "text-[var(--cc-accent-dark)]",
  textStrong: "text-[var(--cc-accent-dark)] font-semibold",
  bgSoft: "bg-[var(--cc-accent-soft)]",
  bgIcon: "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]",
  borderSoft: "border-[var(--cc-accent-border)]",
  borderMedium: "border-[var(--cc-accent-border)]",
  pillActive:
    "border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]",
  navActive: "bg-[var(--cc-accent-soft)] font-medium text-[var(--cc-accent-dark)]",
  progress: "bg-[var(--cc-accent)]",
  dot: "bg-[var(--cc-accent)]/60",
  bulletBefore: "before:bg-[var(--cc-accent)]/60",
  calloutBorder: "border-[var(--cc-accent-border)]",
  calloutBg: "bg-[var(--cc-accent-soft)]",
  h2Bar: "bg-[var(--cc-accent)]",
  h3Heading: "text-[var(--cc-accent-dark)]",
  totalRow: "border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)]",
}

const SyllabusAccentContext = createContext<SyllabusAccentClasses>(BRAND_ACCENT)

export function SyllabusAccentProvider({
  accent,
  children,
}: {
  accent: SyllabusAccentMode
  children: ReactNode
}) {
  const value = accent === "brand" ? BRAND_ACCENT : PORTAL_ACCENT
  return <SyllabusAccentContext.Provider value={value}>{children}</SyllabusAccentContext.Provider>
}

export function useSyllabusAccent() {
  return useContext(SyllabusAccentContext)
}
