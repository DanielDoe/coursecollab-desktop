import { sql } from "@/lib/db"
import {
  getRolloverApplyCutoffDaysBeforeSemesterEnd,
  getSelfServiceRolloverApplyDeadline,
  isSelfServiceRolloverApplyOpen,
} from "@/lib/rollover-policy"

export type AcademicTermRow = {
  id: number
  year: number
  term: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
}

export type RolloverPolicyPayload = {
  self_service_open: boolean
  apply_deadline_iso: string
  cutoff_days_before_semester_end: number
  semester_end_iso: string
  academic_term_label: string | null
  /** When false, UI should not show the semester-wide Extend closed banner. */
  show_closed_notice: boolean
}

const TTL_MS = 60 * 1000
let activeTermCache: { at: number; term: AcademicTermRow | null } | null = null

export function invalidateActiveAcademicTermCache(): void {
  activeTermCache = null
}

/** Human label, e.g. "Summer 2026". */
export function formatAcademicTermLabel(year: number, term: string): string {
  return `${String(term).trim()} ${year}`
}

export async function getActiveAcademicTerm(): Promise<AcademicTermRow | null> {
  if (activeTermCache && Date.now() - activeTermCache.at < TTL_MS) {
    return activeTermCache.term
  }
  const rows = await sql`
    SELECT id, year, term, start_date, end_date, is_active
    FROM academic_terms
    WHERE is_active = true
    ORDER BY year DESC,
      CASE term
        WHEN 'Fall' THEN 1
        WHEN 'Winter' THEN 2
        WHEN 'Spring' THEN 3
        WHEN 'Summer' THEN 4
      END DESC
    LIMIT 1
  `
  const term = rows.length ? (rows[0] as AcademicTermRow) : null
  activeTermCache = { at: Date.now(), term }
  return term
}

/** Semester end instant for rollover — prefers active term end_date, else env fallback. */
export function semesterEndDateFromTermEnd(endDate: string | Date | null | undefined): Date | null {
  if (endDate == null || endDate === "") return null
  const d = endDate instanceof Date ? endDate : new Date(String(endDate))
  if (Number.isNaN(d.getTime())) return null
  const end = new Date(d.getTime())
  end.setUTCHours(23, 59, 59, 999)
  return end
}

export function buildRolloverPolicyForTermEnd(
  termEnd: Date | null,
  label: string | null,
  at: Date = new Date(),
): RolloverPolicyPayload {
  if (!termEnd) {
    return {
      self_service_open: true,
      apply_deadline_iso: "",
      cutoff_days_before_semester_end: getRolloverApplyCutoffDaysBeforeSemesterEnd(),
      semester_end_iso: "",
      academic_term_label: label,
      show_closed_notice: false,
    }
  }

  const days = getRolloverApplyCutoffDaysBeforeSemesterEnd()
  const deadline = getSelfServiceRolloverApplyDeadline(termEnd, days)
  const open = isSelfServiceRolloverApplyOpen(termEnd, days, at)

  return {
    self_service_open: open,
    apply_deadline_iso: deadline.toISOString(),
    cutoff_days_before_semester_end: days,
    semester_end_iso: termEnd.toISOString(),
    academic_term_label: label,
    show_closed_notice: !open,
  }
}

export async function buildActiveTermRolloverPolicy(at: Date = new Date()): Promise<RolloverPolicyPayload> {
  const active = await getActiveAcademicTerm()
  const label = active ? formatAcademicTermLabel(active.year, active.term) : null
  const termEnd = semesterEndDateFromTermEnd(active?.end_date ?? null)
  return buildRolloverPolicyForTermEnd(termEnd, label, at)
}

/** True when the course is offered in the active academic term. */
export async function isCourseInActiveAcademicTerm(courseId: number): Promise<boolean> {
  const active = await getActiveAcademicTerm()
  if (!active) return false
  const rows = await sql`
    SELECT 1
    FROM academic_term_courses atc
    WHERE atc.course_id = ${courseId}
      AND atc.academic_term_id = ${active.id}
    LIMIT 1
  `
  return rows.length > 0
}

/** @deprecated No longer used for student login — roster/university login resolves sessions across all terms. */
export async function requireCourseInActiveTermForStudent(
  courseId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const active = await getActiveAcademicTerm()
  if (!active) {
    return {
      ok: false,
      message: "No active academic term is configured. Contact your instructor.",
    }
  }
  const inTerm = await isCourseInActiveAcademicTerm(courseId)
  if (!inTerm) {
    const label = formatAcademicTermLabel(active.year, active.term)
    return {
      ok: false,
      message: `This course is not offered in the current term (${label}). Contact your instructor if you need access.`,
    }
  }
  return { ok: true }
}

/** @deprecated No longer used to block student platform access — enrollments may span any term. */
export async function isStudentEnrollmentInActiveTerm(studentDbId: number): Promise<boolean> {
  const active = await getActiveAcademicTerm()
  if (!active) return false
  const rows = await sql`
    SELECT 1
    FROM students st
    LEFT JOIN sessions s ON s.id = st.session_id
    WHERE st.id = ${studentDbId}
      AND (
        (s.id IS NOT NULL AND s.academic_term_id = ${active.id})
        OR (
          st.course_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM academic_term_courses atc
            WHERE atc.course_id = st.course_id AND atc.academic_term_id = ${active.id}
          )
        )
      )
    LIMIT 1
  `
  return rows.length > 0
}

/** Deactivate all other terms and mark the given term active. */
export async function setActiveAcademicTerm(termId: number): Promise<AcademicTermRow | null> {
  await sql`
    UPDATE academic_terms
    SET is_active = false, updated_at = NOW()
    WHERE id != ${termId} AND is_active = true
  `
  const rows = await sql`
    UPDATE academic_terms
    SET is_active = true, updated_at = NOW()
    WHERE id = ${termId}
    RETURNING id, year, term, start_date, end_date, is_active
  `
  invalidateActiveAcademicTermCache()
  return rows.length ? (rows[0] as AcademicTermRow) : null
}
