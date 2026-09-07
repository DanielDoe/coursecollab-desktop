/** How a KPI tile value should read on the dashboard. */
export type KpiValueKind = "count" | "percent" | "decimal" | "auto"

/** Round to 2 dp — fixes float noise without forcing ".00" on counts. */
export function roundKpiNumber(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

export function formatKpiCount(value: number): string {
  return String(Math.round(roundKpiNumber(value)))
}

export function formatKpiDecimal(value: number): string {
  return roundKpiNumber(value).toFixed(2)
}

export function formatKpiNumber(value: number): string {
  return formatKpiDecimal(value)
}

export function formatKpiPercent(value: number): string {
  return `${formatKpiDecimal(value)}%`
}

const COUNT_LABEL =
  /\b(students?|quizzes?|attempts?|issues?|submissions?|assessments?|deadlines?|missing|streak|enrollments?|modules?|checkpoints?|events?|requests?|courses?|faculty|staff|campers?|users?|active quizzes|account requests|open issues|pending|feedback|discussions?|trainings?|xp|rank)\b/i

const PERCENT_LABEL =
  /\b(average|grade|attendance|progress|health|mastery)\b/i

const DECIMAL_LABEL = /\b(classroom points|engagement credits|credits)\b/i

export function inferKpiValueKind(label: string, value: string | number): KpiValueKind {
  if (typeof value === "string" && /%\s*$/.test(value.trim())) return "percent"
  if (DECIMAL_LABEL.test(label)) return "decimal"
  if (COUNT_LABEL.test(label)) return "count"
  if (PERCENT_LABEL.test(label) && !/\b(students?|quizzes?|attempts?)\b/i.test(label)) {
    return "percent"
  }
  return "auto"
}

function parseNumeric(value: string | number): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const trimmed = value.trim()
  const pct = /^(-?\d+(?:\.\d+)?)\s*%$/.exec(trimmed)
  if (pct) return Number(pct[1])
  if (!/^-?\d/.test(trimmed)) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

function isWholeNumber(value: number): boolean {
  const rounded = roundKpiNumber(value)
  return Number.isInteger(rounded) || Math.abs(rounded - Math.round(rounded)) < 1e-9
}

function resolveAutoKind(value: string | number): KpiValueKind {
  if (typeof value === "string" && /%\s*$/.test(value.trim())) return "percent"
  const n = parseNumeric(value)
  if (n == null) return "count"
  return isWholeNumber(n) ? "count" : "decimal"
}

function isPassThroughLabel(value: string): boolean {
  const trimmed = value.trim()
  return (
    /^#/.test(trimmed) ||
    trimmed === "—" ||
    trimmed === "-" ||
    (/[A-Za-z]/.test(trimmed) && !/^-?\d/.test(trimmed) && !/%/.test(trimmed))
  )
}

/** Format the primary KPI card value. Counts stay whole; scores/rates use 2 dp. */
export function formatDashboardKpiValue(
  value: string | number,
  kind: KpiValueKind = "auto",
  label?: string,
): string | number {
  if (typeof value === "string" && isPassThroughLabel(value)) return value

  const resolved =
    kind === "auto" && label ? inferKpiValueKind(label, value) : kind === "auto" ? resolveAutoKind(value) : kind

  if (resolved === "percent") {
    if (typeof value === "string" && /%\s*$/.test(value.trim())) {
      const n = parseNumeric(value)
      return n != null ? formatKpiPercent(n) : value
    }
    const n = parseNumeric(value)
    return n != null ? formatKpiPercent(n) : value
  }

  const n = parseNumeric(value)
  if (n == null) return value

  if (resolved === "count") return formatKpiCount(n)
  if (resolved === "decimal") return formatKpiDecimal(n)
  return isWholeNumber(n) ? formatKpiCount(n) : formatKpiDecimal(n)
}

/** Replace bare percentages and decimal ratios in KPI subtitles. */
export function formatKpiSubtext(text: string): string {
  return text
    .replace(/(-?\d+(?:\.\d+)?)\s*%/g, (_, raw) => formatKpiPercent(Number(raw)))
    .replace(/(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g, (_, rawNum, rawDenom) => {
      const num = Number(rawNum)
      const denom = Number(rawDenom)
      const numOut = isWholeNumber(num) ? formatKpiCount(num) : formatKpiDecimal(num)
      const denomOut = isWholeNumber(denom) ? formatKpiCount(denom) : formatKpiDecimal(denom)
      return `${numOut}/${denomOut}`
    })
}
