import { sql } from "@/lib/db"
import { CENTRAL_TIMEZONE } from "@/lib/central-time"

export type StudentEnrollmentTerm = {
  termId: number
  year: number
  term: string
  startDate: string | null
  endDate: string | null
}

const enrollmentTermCache = new Map<number, { at: number; term: StudentEnrollmentTerm | null }>()
const CACHE_TTL_MS = 60_000

function parseTermStartInstant(startDate: string): Date | null {
  const trimmed = startDate.trim()
  if (!trimmed) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  if (!match) return null
  const [, year, month, day] = match
  const ctStart = new Date(`${year}-${month}-${day}T00:00:00`)
  const utcWall = new Date(
    ctStart.toLocaleString("en-US", { timeZone: "UTC" }),
  )
  const ctWall = new Date(
    ctStart.toLocaleString("en-US", { timeZone: CENTRAL_TIMEZONE }),
  )
  const offsetMs = utcWall.getTime() - ctWall.getTime()
  return new Date(ctStart.getTime() + offsetMs)
}

/** Resolve the academic term for a student's enrollment session. */
export async function getStudentEnrollmentTerm(
  studentDbId: number,
): Promise<StudentEnrollmentTerm | null> {
  const cached = enrollmentTermCache.get(studentDbId)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.term
  }

  const rows = await sql`
    SELECT
      at.id,
      at.year,
      at.term,
      at.start_date::text AS start_date,
      at.end_date::text AS end_date
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    LEFT JOIN academic_terms at ON at.id = sess.academic_term_id
    WHERE s.id = ${studentDbId}
    LIMIT 1
  `

  let row = rows[0] as {
    id: number | null
    year: number | null
    term: string | null
    start_date: string | null
    end_date: string | null
  } | undefined

  if (!row?.id) {
    const fallback = await sql`
      SELECT
        at.id,
        at.year,
        at.term,
        at.start_date::text AS start_date,
        at.end_date::text AS end_date
      FROM students s
      JOIN academic_term_courses atc ON atc.course_id = s.course_id
      JOIN academic_terms at ON at.id = atc.academic_term_id
      WHERE s.id = ${studentDbId}
        AND at.is_active = true
      ORDER BY at.start_date DESC NULLS LAST
      LIMIT 1
    `
    row = fallback[0] as typeof row
  }

  if (!row?.id) {
    enrollmentTermCache.set(studentDbId, { at: Date.now(), term: null })
    return null
  }

  const term: StudentEnrollmentTerm = {
    termId: Number(row.id),
    year: Number(row.year),
    term: String(row.term),
    startDate: row.start_date,
    endDate: row.end_date,
  }

  enrollmentTermCache.set(studentDbId, { at: Date.now(), term })
  return term
}

/** True once the enrollment term's start_date has begun (Central Time, start of day). */
export async function isStudentCourseStarted(
  studentDbId: number,
  at: Date = new Date(),
): Promise<boolean> {
  const enrollment = await getStudentEnrollmentTerm(studentDbId)
  if (!enrollment?.startDate) return true
  const startInstant = parseTermStartInstant(enrollment.startDate)
  if (!startInstant) return true
  return at.getTime() >= startInstant.getTime()
}

/** True before the student's enrollment term start date. */
export async function isPreCourseStudent(studentDbId: number, at?: Date): Promise<boolean> {
  return !(await isStudentCourseStarted(studentDbId, at))
}

/** Notification types hidden pre-course — assessments & classroom points only. */
const PRE_COURSE_BLOCKED_NOTIFICATION_TYPES = new Set([
  "quiz",
  "homework",
  "exam",
  "deadline",
  "code_submission",
  "practice",
  "grade",
])

export function isPreCourseAssessmentNotification(type: string | null | undefined): boolean {
  return PRE_COURSE_BLOCKED_NOTIFICATION_TYPES.has(String(type ?? "").toLowerCase())
}

export function isWelcomePlatformNotification(row: {
  type?: string | null
  title?: string | null
  message?: string | null
  content?: string | null
}): boolean {
  if (row.type != null && String(row.type).toLowerCase() !== "announcement") return false
  const haystack = `${row.title ?? ""} ${row.message ?? ""} ${row.content ?? ""}`.toLowerCase()
  return (
    haystack.includes("welcome") ||
    haystack.includes("getting started") ||
    haystack.includes("glad you're here")
  )
}

export function filterPreCourseNotifications<T extends {
  type?: string | null
  title?: string | null
  message?: string | null
}>(notifications: T[]): T[] {
  return notifications.filter((n) => !isPreCourseAssessmentNotification(n.type))
}
