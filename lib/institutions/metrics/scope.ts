import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { getActiveInstitutionLicense } from "@/lib/institutions/licenses"
import type { InstitutionDatePreset } from "@/lib/institutions/metrics/constants"
import type { InstitutionMetricFilters, InstitutionScope, MetricComparison } from "@/lib/institutions/metrics/types"

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Normalize Postgres `date` / JS Date values to YYYY-MM-DD (avoids Invalid Date on charts). */
export function parsePgDateOnly(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const raw = String(value ?? "")
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return raw.slice(0, 10)
}

export function formatWeekLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

function diffDays(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime()
  const b = new Date(`${to}T00:00:00Z`).getTime()
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1)
}

export function resolveDateRange(input: {
  preset?: InstitutionDatePreset | string | null
  from?: string | null
  to?: string | null
  licenseStart?: string | null
  licenseEnd?: string | null
}): { from: string; to: string; preset: InstitutionDatePreset; previousFrom: string; previousTo: string } {
  const today = new Date()
  const to = input.to && /^\d{4}-\d{2}-\d{2}/.test(input.to) ? input.to.slice(0, 10) : isoDate(today)
  const preset = (input.preset ?? "last_30_days") as InstitutionDatePreset

  let from: string
  switch (preset) {
    case "today":
      from = to
      break
    case "last_7_days":
      from = isoDate(addDays(new Date(`${to}T00:00:00Z`), -6))
      break
    case "current_term":
      from = input.licenseStart?.slice(0, 10) ?? isoDate(addDays(new Date(`${to}T00:00:00Z`), -89))
      break
    case "previous_term": {
      const termStart = input.licenseStart ? new Date(`${input.licenseStart.slice(0, 10)}T00:00:00Z`) : addDays(new Date(`${to}T00:00:00Z`), -179)
      const termEnd = input.licenseEnd ? new Date(`${input.licenseEnd.slice(0, 10)}T00:00:00Z`) : new Date(`${to}T00:00:00Z`)
      const span = Math.max(30, Math.round((termEnd.getTime() - termStart.getTime()) / 86_400_000))
      from = isoDate(addDays(termStart, -span))
      break
    }
    case "academic_year":
      from = isoDate(addDays(new Date(`${to}T00:00:00Z`), -364))
      break
    case "previous_academic_year":
      from = isoDate(addDays(new Date(`${to}T00:00:00Z`), -729))
      break
    case "custom":
      from =
        input.from && /^\d{4}-\d{2}-\d{2}/.test(input.from)
          ? input.from.slice(0, 10)
          : isoDate(addDays(new Date(`${to}T00:00:00Z`), -29))
      break
    case "last_30_days":
    default:
      from = isoDate(addDays(new Date(`${to}T00:00:00Z`), -29))
      break
  }

  const span = diffDays(from, to)
  const previousTo = isoDate(addDays(new Date(`${from}T00:00:00Z`), -1))
  const previousFrom = isoDate(addDays(new Date(`${previousTo}T00:00:00Z`), -(span - 1)))

  return { from, to, preset, previousFrom, previousTo }
}

export async function resolveInstitutionScope(
  institutionId: number,
  filters: Partial<InstitutionMetricFilters> = {},
): Promise<InstitutionScope | null> {
  await ensureInstitutionSchema()
  const license = await getActiveInstitutionLicense(institutionId)
  const licenseId = license ? Number(license.id) : filters.licenseId ?? null

  let courseIds: number[] = []
  if (licenseId) {
    const scopeRows = await sql`
      SELECT DISTINCT course_id::int AS course_id
      FROM institution_license_scopes
      WHERE license_id = ${licenseId}
        AND course_id IS NOT NULL
    `
    courseIds = scopeRows.map((r) => Number(r.course_id)).filter((id) => Number.isFinite(id) && id > 0)
    if (courseIds.length === 0 && String(license?.scope_type ?? "") === "institution") {
      const instCourses = await sql`
        SELECT id::int AS id FROM courses WHERE university_id = ${institutionId}
      `
      courseIds = instCourses.map((r) => Number(r.id)).filter((id) => id > 0)
    }
  }

  if (filters.courseId && Number.isFinite(filters.courseId)) {
    courseIds = courseIds.filter((id) => id === filters.courseId)
  }

  if (filters.organizationUnitId && Number.isFinite(filters.organizationUnitId) && licenseId) {
    const unitCourses = await sql`
      SELECT DISTINCT course_id::int AS id
      FROM institution_license_scopes
      WHERE license_id = ${licenseId}
        AND organization_unit_id = ${filters.organizationUnitId}
        AND course_id IS NOT NULL
    `
    const allowed = new Set(unitCourses.map((r) => Number(r.id)))
    if (allowed.size > 0) {
      courseIds = courseIds.filter((id) => allowed.has(id))
    }
  }

  if (filters.instructorId && Number.isFinite(filters.instructorId) && courseIds.length > 0) {
    const instructorCourses = await sql`
      SELECT DISTINCT course_id::int AS id
      FROM course_instructors
      WHERE instructor_id = ${filters.instructorId}
        AND course_id = ANY(${courseIds})
    `.catch(() => [])
    const allowed = new Set(instructorCourses.map((r) => Number(r.id)))
    if (allowed.size > 0) {
      courseIds = courseIds.filter((id) => allowed.has(id))
    }
  }

  if (filters.sectionId && Number.isFinite(filters.sectionId) && courseIds.length > 0) {
    const sectionCourses = await sql`
      SELECT DISTINCT course_id::int AS id FROM students
      WHERE section_id = ${filters.sectionId}
        AND course_id = ANY(${courseIds})
        AND deleted_at IS NULL
    `.catch(() => [])
    const allowed = new Set(sectionCourses.map((r) => Number(r.id)))
    if (allowed.size > 0) {
      courseIds = courseIds.filter((id) => allowed.has(id))
    }
  }

  const range = resolveDateRange({
    preset: filters.preset,
    from: filters.from,
    to: filters.to,
    licenseStart: license?.start_date ? String(license.start_date) : null,
    licenseEnd: license?.end_date ? String(license.end_date) : null,
  })

  return {
    institutionId,
    licenseId,
    courseIds,
    ...range,
    preset: range.preset,
  }
}

export function buildComparison(current: number, previous: number): MetricComparison {
  if (previous === 0 && current === 0) {
    return { value: current, previousValue: previous, changePercent: null, changeLabel: "flat" }
  }
  if (previous === 0 && current > 0) {
    return { value: current, previousValue: previous, changePercent: null, changeLabel: "new" }
  }
  if (previous === 0) {
    return { value: current, previousValue: previous, changePercent: null, changeLabel: "unavailable" }
  }
  const changePercent = Math.round(((current - previous) / previous) * 1000) / 10
  const changeLabel = changePercent > 0.5 ? "up" : changePercent < -0.5 ? "down" : "flat"
  return { value: current, previousValue: previous, changePercent, changeLabel }
}

export function licenseUtilizationStatus(pct: number | null): {
  status: "normal" | "monitor" | "approaching" | "capacity_warning" | "unknown"
  label: string
} {
  if (pct == null) return { status: "unknown", label: "Capacity unknown" }
  if (pct >= 95) return { status: "capacity_warning", label: "Capacity warning" }
  if (pct >= 85) return { status: "approaching", label: "Approaching capacity" }
  if (pct >= 70) return { status: "monitor", label: "Monitor utilization" }
  return { status: "normal", label: "Normal utilization" }
}

export function canViewStudentLevelAnalytics(role: string): boolean {
  return (
    role === "owner" ||
    role === "institution_admin" ||
    role === "academic_admin" ||
    role === "department_admin"
  )
}

export function daysBetween(from: string, to: string): number {
  return diffDays(from, to)
}

export function daysUntil(endDate: string | null | undefined): number | null {
  if (!endDate) return null
  const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(end.getTime())) return null
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000)
}
