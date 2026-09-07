import { DAY_CODE_LABELS, DAY_CODES, type DayCode } from "@/lib/schedule-adjustment/time-slots"

export type SchedulePollKind = "recurring" | "one_off"

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const JS_DAY_TO_CODE = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const

export function isIsoDateColumn(value: string): boolean {
  return ISO_DATE_RE.test(value)
}

export function parseCandidateDates(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.map((v) => String(v).slice(0, 10)).filter((v) => ISO_DATE_RE.test(v)))].sort()
}

export function weekdayFromIsoDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map((n) => Number.parseInt(n, 10))
  const date = new Date(y, (m || 1) - 1, d || 1)
  return JS_DAY_TO_CODE[date.getDay()] ?? "MO"
}

export function formatPollColumnLabel(column: string): string {
  if (isIsoDateColumn(column)) {
    const [y, m, d] = column.split("-").map((n) => Number.parseInt(n, 10))
    const date = new Date(y, (m || 1) - 1, d || 1)
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  }
  return DAY_CODE_LABELS[column as DayCode] ?? column
}

export function pollColumns(input: {
  pollKind?: SchedulePollKind | null
  candidateDays?: string[] | null
  candidateDates?: string[] | null
}): string[] {
  if (input.pollKind === "one_off") {
    return parseCandidateDates(input.candidateDates)
  }
  const days = (input.candidateDays ?? []).filter((d) => DAY_CODES.includes(d as DayCode))
  return days.length ? days : [...DAY_CODES]
}
