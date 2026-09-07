export type ProgressReviewPeriod = "midterm" | "final" | "custom"

export type ReviewPeriodConfig = {
  id: ProgressReviewPeriod
  label: string
  shortLabel: string
  description: string
  aiFocus: string
  emailTitle: string
  announcementTitle: (courseCode: string) => string
  emailSubject: (courseCode: string) => string
}

export const REVIEW_PERIOD_OPTIONS: ReviewPeriodConfig[] = [
  {
    id: "midterm",
    label: "Mid-Term",
    shortLabel: "Mid-Term",
    description: "Checkpoint review — quizzes, homework, mid-semester exams, practice, and attendance so far.",
    aiFocus:
      "This is a mid-term progress review. Emphasize performance through the mid-semester checkpoint, readiness for the second half of the term, and patterns from quizzes, homework, and the mid-semester exam if present.",
    emailTitle: "Mid-Term Progress Review",
    announcementTitle: (course) => `Mid-Term Progress Review — ${course}`,
    emailSubject: (course) => `Your Mid-Term Progress Review — ${course}`,
  },
  {
    id: "final",
    label: "Finals",
    shortLabel: "Finals",
    description: "End-of-term review — cumulative grades, final exam performance, and closing recommendations.",
    aiFocus:
      "This is a finals / end-of-term progress review. Emphasize cumulative performance, final exam results if present, overall grade trajectory, and concrete steps before the course ends.",
    emailTitle: "Final Progress Review",
    announcementTitle: (course) => `Final Progress Review — ${course}`,
    emailSubject: (course) => `Your Final Progress Review — ${course}`,
  },
  {
    id: "custom",
    label: "As of date",
    shortLabel: "Custom",
    description: "Snapshot of progress through a specific date — useful for ad-hoc check-ins.",
    aiFocus:
      "This is a dated progress snapshot. Frame feedback as progress through the specified as-of date only; do not reference activity after that date.",
    emailTitle: "Progress Review",
    announcementTitle: (course) => `Progress Review — ${course}`,
    emailSubject: (course) => `Your Progress Review — ${course}`,
  },
]

export function getReviewPeriodConfig(period: string | null | undefined): ReviewPeriodConfig {
  const hit = REVIEW_PERIOD_OPTIONS.find((o) => o.id === period)
  return hit ?? REVIEW_PERIOD_OPTIONS[0]
}

export function parseReviewPeriod(raw: unknown): ProgressReviewPeriod {
  const s = String(raw ?? "").trim().toLowerCase()
  if (s === "final" || s === "finals") return "final"
  if (s === "custom" || s === "as_of" || s === "as-of") return "custom"
  return "midterm"
}

/** End of local calendar day for SQL upper bound (inclusive). */
export function asOfDateEndIso(dateStr: string | null | undefined): string | null {
  if (!dateStr?.trim()) return null
  const d = new Date(`${dateStr.trim()}T23:59:59.999`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/** Normalize DB date values to YYYY-MM-DD for API clients. */
export function formatReviewAsOfDateIso(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  const raw = String(value).trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const parsed = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

export function formatAsOfLabel(dateStr: string | null | undefined): string | null {
  if (!dateStr?.trim()) return null
  const d = new Date(`${dateStr.trim()}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function periodBadgeLabel(period: ProgressReviewPeriod, asOfDate?: string | null): string {
  const cfg = getReviewPeriodConfig(period)
  if (period === "custom" && asOfDate) {
    const fmt = formatAsOfLabel(asOfDate)
    return fmt ? `As of ${fmt}` : cfg.shortLabel
  }
  return cfg.shortLabel
}
