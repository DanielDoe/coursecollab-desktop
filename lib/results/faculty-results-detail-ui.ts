import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

/** Neutral inset — matches portal surfaces, no module accent tint */
const SOFT_INSET = "rounded-xl bg-[var(--muted)]/40"
const PANEL = "rounded-2xl bg-[var(--card)] overflow-hidden"
const PREVIEW_INSET = "rounded-lg bg-[var(--card)]"

export type FacultyResultsDetailTheme = {
  fp: ReturnType<typeof facultyEmbedChrome>["p"]
  cta: string
  outline: string
  mainCard: string
  title: string
  subtitle: string
  infoPill: string
  neutralPanel: string
  referencePanel: string
  insetPanel: string
  chip: string
  ptsBadge: string
  ptsIcon: string
  ptsText: string
  ptsSub: string
  questionCard: string
  optionNeutral: string
  sectionCard: (selected: boolean) => string
  sectionHeader: (highlighted: boolean) => string
  sectionHeaderText: string
  sectionHeaderMeta: string
  questionHighlight: string
  manualBadge: string
  accentRing: string
  aiIconWell: string
  sampleAnswerHeader: string
  studentPreviewPanel: string
  studentPreviewInset: string
  mutedLabel: string
  bodyStrong: string
}

export function getFacultyResultsDetailTheme(
  embedInDashboard: boolean,
  userType: string,
): FacultyResultsDetailTheme | null {
  if (!embedInDashboard || userType !== "instructor") return null
  const chrome = facultyEmbedChrome("results")
  const { p: fp, cta, outline } = chrome

  return {
    fp,
    cta,
    outline,
    mainCard: cn(PANEL, "question-card min-w-0 shadow-none border-0"),
    title: cn("text-xl sm:text-2xl md:text-3xl font-bold tracking-tight break-words", fp.iconText),
    subtitle: cn("text-xs sm:text-sm mt-2", PORTAL_TEXT_MUTED),
    infoPill: cn("flex items-center justify-center gap-2 rounded-xl px-4 py-3", SOFT_INSET),
    neutralPanel: cn("flex flex-wrap items-center gap-2 rounded-xl p-4", SOFT_INSET),
    referencePanel: cn("rounded-xl p-4", SOFT_INSET),
    studentPreviewPanel: cn("rounded-xl p-4 space-y-4", SOFT_INSET),
    studentPreviewInset: cn(PREVIEW_INSET, "p-3"),
    mutedLabel: cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED),
    bodyStrong: cn("font-bold", PORTAL_TEXT),
    insetPanel: cn("mt-4 rounded-xl p-3 sm:p-4", SOFT_INSET),
    chip: cn("flex items-center gap-2 px-4 py-2 rounded-xl", SOFT_INSET),
    ptsBadge: cn("flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--muted)]/50"),
    ptsIcon: fp.iconText,
    ptsText: cn("text-sm font-bold", PORTAL_TEXT),
    ptsSub: cn("text-xs", PORTAL_TEXT_MUTED),
    questionCard: cn(PANEL, "shadow-none border-0 scroll-mt-24"),
    optionNeutral: cn("rounded-xl p-4", SOFT_INSET),
    sectionCard: (selected) =>
      cn(
        "relative overflow-hidden rounded-2xl text-left w-full sm:w-72 sm:max-w-[18rem] sm:flex-shrink-0 cursor-pointer transition-all duration-200",
        SOFT_INSET,
        selected && "bg-[var(--muted)]/55 ring-1 ring-[var(--border)]",
      ),
    sectionHeader: (highlighted) =>
      cn(
        "flex items-center gap-2 py-2 px-4 rounded-xl scroll-mt-24 transition-colors",
        highlighted ? "bg-[var(--muted)]/55" : SOFT_INSET,
      ),
    sectionHeaderText: cn("font-semibold", PORTAL_TEXT),
    sectionHeaderMeta: cn("font-normal ml-1", PORTAL_TEXT_MUTED),
    questionHighlight: "bg-[var(--muted)]/55",
    manualBadge: cn("rounded-full bg-[var(--muted)]/50", PORTAL_TEXT),
    accentRing: "ring-orange-500/40 dark:ring-orange-400/35",
    aiIconWell: cn("p-2 rounded-xl", fp.iconBg),
    sampleAnswerHeader: cn("px-4 py-2.5 bg-[var(--muted)]/40"),
  }
}
