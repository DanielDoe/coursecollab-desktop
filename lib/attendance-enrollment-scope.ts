import { sql } from "@/lib/db"

export type EnrollmentAttendanceWindow = {
  courseId: number
  sectionCode: string
  academicTermId: number | null
  termStart: string | null
  termEnd: string | null
}

/**
 * The driver hands back `date` columns as Date objects, so String(value) yields
 * "Tue Aug 25 2026 ..." and slicing 10 chars produced "Tue Aug 25" — which
 * Postgres rejected on every `::date` cast below. Read the local calendar parts
 * instead; a date-only column parses as local midnight, so UTC conversion can
 * land on the wrong day.
 */
function toDateOnly(value: string | Date | null | undefined): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  const text = String(value).trim()
  if (!text) return null
  const iso = text.match(/^\d{4}-\d{2}-\d{2}/)
  if (iso) return iso[0]
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : toDateOnly(parsed)
}

/** Official term start minus grace for syllabus / pre-term sessions with attendance. */
export function termStartWithGrace(
  termStart: string | null | undefined,
  graceDays = 14,
): string | null {
  if (!termStart) return null
  const d = new Date(`${termStart}T12:00:00`)
  if (Number.isNaN(d.getTime())) return termStart
  d.setDate(d.getDate() - graceDays)
  return toDateOnly(d)
}

/** Current course + academic-term window for a student's attendance stats. */
export async function getEnrollmentAttendanceWindow(
  studentDbId: number,
): Promise<EnrollmentAttendanceWindow | null> {
  const rows = await sql`
    SELECT
      s.course_id,
      COALESCE(NULLIF(TRIM(sess.code), ''), NULLIF(TRIM(s.section), '')) AS section_code,
      sess.academic_term_id,
      at.start_date,
      at.end_date
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    LEFT JOIN academic_terms at ON at.id = sess.academic_term_id
    WHERE s.id = ${studentDbId}
    LIMIT 1
  `
  if (rows.length === 0) return null
  const row = rows[0] as {
    course_id: number | null
    section_code: string | null
    academic_term_id: number | null
    start_date: string | Date | null
    end_date: string | Date | null
  }
  const courseId = Number(row.course_id)
  const sectionCode = String(row.section_code ?? "").trim()
  if (!Number.isFinite(courseId) || courseId <= 0 || !sectionCode) return null
  return {
    courseId,
    sectionCode,
    academicTermId:
      row.academic_term_id != null && Number.isFinite(Number(row.academic_term_id))
        ? Number(row.academic_term_id)
        : null,
    termStart: toDateOnly(row.start_date),
    termEnd: toDateOnly(row.end_date),
  }
}

export async function getCourseSectionAttendanceWindow(
  courseId: number,
  section: string,
  academicTermId?: number | null,
  sessionId?: number | null,
): Promise<EnrollmentAttendanceWindow | null> {
  const sectionCode = String(section ?? "").trim()
  const sid =
    sessionId != null && Number.isFinite(Number(sessionId)) && Number(sessionId) > 0
      ? Math.trunc(Number(sessionId))
      : null
  if (!Number.isFinite(courseId) || courseId <= 0) return null
  if (sid == null && !sectionCode) return null

  const tid =
    academicTermId != null && Number.isFinite(Number(academicTermId)) && Number(academicTermId) > 0
      ? Math.trunc(Number(academicTermId))
      : null

  if (sid != null) {
    const bySession = await sql`
      SELECT sess.academic_term_id, at.start_date, at.end_date, sess.code
      FROM sessions sess
      LEFT JOIN academic_terms at ON at.id = sess.academic_term_id
      WHERE sess.id = ${sid}
        AND sess.course_id = ${courseId}
      LIMIT 1
    `
    if (bySession.length === 0) return null
    const row = bySession[0] as {
      academic_term_id: number | null
      start_date: string | Date | null
      end_date: string | Date | null
      code: string
    }
    return {
      courseId,
      sectionCode: String(row.code ?? sectionCode).trim(),
      academicTermId:
        row.academic_term_id != null && Number.isFinite(Number(row.academic_term_id))
          ? Number(row.academic_term_id)
          : null,
      termStart: toDateOnly(row.start_date),
      termEnd: toDateOnly(row.end_date),
    }
  }

  const rows =
    tid != null
      ? await sql`
          SELECT sess.academic_term_id, at.start_date, at.end_date, sess.code
          FROM sessions sess
          LEFT JOIN academic_terms at ON at.id = sess.academic_term_id
          WHERE sess.course_id = ${courseId}
            AND TRIM(sess.code) = TRIM(${sectionCode})
            AND sess.academic_term_id = ${tid}
          ORDER BY sess.id DESC
          LIMIT 1
        `
      : await sql`
          SELECT sess.academic_term_id, at.start_date, at.end_date, sess.code
          FROM sessions sess
          LEFT JOIN academic_terms at ON at.id = sess.academic_term_id
          WHERE sess.course_id = ${courseId}
            AND TRIM(sess.code) = TRIM(${sectionCode})
          ORDER BY sess.id DESC
          LIMIT 1
        `
  if (rows.length === 0) {
    return {
      courseId,
      sectionCode,
      academicTermId: null,
      termStart: null,
      termEnd: null,
    }
  }
  const row = rows[0] as {
    academic_term_id: number | null
    start_date: string | Date | null
    end_date: string | Date | null
    code: string
  }
  return {
    courseId,
    sectionCode: String(row.code ?? sectionCode).trim(),
    academicTermId:
      row.academic_term_id != null && Number.isFinite(Number(row.academic_term_id))
        ? Number(row.academic_term_id)
        : null,
    termStart: toDateOnly(row.start_date),
    termEnd: toDateOnly(row.end_date),
  }
}

export async function countTermAttendanceRecords(
  studentDbId: number,
  window: EnrollmentAttendanceWindow,
): Promise<number> {
  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS n
      FROM attendance_records ar
      INNER JOIN attendance_sessions asess ON asess.id = ar.session_id
      WHERE ar.student_id = ${studentDbId}
        AND ar.deleted_at IS NULL
        AND TRIM(asess.section) = TRIM(${window.sectionCode})
        AND (asess.course_id IS NULL OR asess.course_id = ${window.courseId})
        AND (${window.termStart}::date IS NULL OR asess.start_time::date >= ${termStartWithGrace(window.termStart)}::date)
        AND (${window.termEnd}::date IS NULL OR asess.start_time::date <= ${window.termEnd}::date)
    `
    return Number((rows[0] as { n: number } | undefined)?.n ?? 0)
  } catch {
    try {
      const rows = await sql`
        SELECT COUNT(*)::int AS n
        FROM attendance_records ar
        INNER JOIN attendance_sessions asess ON asess.id = ar.session_id
        WHERE ar.student_id = ${studentDbId}
          AND TRIM(asess.section) = TRIM(${window.sectionCode})
          AND (asess.course_id IS NULL OR asess.course_id = ${window.courseId})
          AND (${window.termStart}::date IS NULL OR asess.start_time::date >= ${termStartWithGrace(window.termStart)}::date)
          AND (${window.termEnd}::date IS NULL OR asess.start_time::date <= ${window.termEnd}::date)
      `
      return Number((rows[0] as { n: number } | undefined)?.n ?? 0)
    } catch {
      return 0
    }
  }
}

export type TermLeaderboardRow = {
  id: number
  full_name: string
  student_id: string
  section: string
  current_streak: number
  longest_streak: number
  total_points: number
  badges: string
  classes_attended: number
  rank: number
}

/** Students in this course/term who have at least one attendance mark this term. */
export async function listTermAttendanceLeaderboard(
  window: EnrollmentAttendanceWindow,
  limit: number,
): Promise<TermLeaderboardRow[]> {
  const cap = Math.min(Math.max(Number(limit) || 10, 1), 100)
  try {
    return (await sql`
      WITH term_marks AS (
        SELECT
          ar.student_id,
          COALESCE(SUM(COALESCE(ar.points_earned, 0)), 0)::float AS total_points,
          COUNT(*)::int AS classes_attended
        FROM attendance_records ar
        INNER JOIN attendance_sessions asess ON asess.id = ar.session_id
        INNER JOIN students s ON s.id = ar.student_id
        LEFT JOIN sessions sess ON sess.id = s.session_id
        WHERE ar.deleted_at IS NULL
          AND TRIM(asess.section) = TRIM(${window.sectionCode})
          AND (asess.course_id IS NULL OR asess.course_id = ${window.courseId})
          AND s.course_id = ${window.courseId}
          AND (
            ${window.academicTermId}::int IS NULL
            OR sess.academic_term_id = ${window.academicTermId}
          )
          AND (${window.termStart}::date IS NULL OR asess.start_time::date >= ${termStartWithGrace(window.termStart)}::date)
          AND (${window.termEnd}::date IS NULL OR asess.start_time::date <= ${window.termEnd}::date)
        GROUP BY ar.student_id
      )
      SELECT
        s.id,
        s.full_name,
        s.student_id,
        s.section,
        0::int AS current_streak,
        0::int AS longest_streak,
        tm.total_points,
        '[]'::text AS badges,
        tm.classes_attended,
        ROW_NUMBER() OVER (ORDER BY tm.total_points DESC, tm.classes_attended DESC, s.full_name ASC) AS rank
      FROM term_marks tm
      INNER JOIN students s ON s.id = tm.student_id
      ORDER BY rank
      LIMIT ${cap}
    `) as TermLeaderboardRow[]
  } catch {
    return (await sql`
      WITH term_marks AS (
        SELECT
          ar.student_id,
          COALESCE(SUM(COALESCE(ar.points_earned, 0)), 0)::float AS total_points,
          COUNT(*)::int AS classes_attended
        FROM attendance_records ar
        INNER JOIN attendance_sessions asess ON asess.id = ar.session_id
        INNER JOIN students s ON s.id = ar.student_id
        LEFT JOIN sessions sess ON sess.id = s.session_id
        WHERE TRIM(asess.section) = TRIM(${window.sectionCode})
          AND (asess.course_id IS NULL OR asess.course_id = ${window.courseId})
          AND s.course_id = ${window.courseId}
          AND (
            ${window.academicTermId}::int IS NULL
            OR sess.academic_term_id = ${window.academicTermId}
          )
          AND (${window.termStart}::date IS NULL OR asess.start_time::date >= ${termStartWithGrace(window.termStart)}::date)
          AND (${window.termEnd}::date IS NULL OR asess.start_time::date <= ${window.termEnd}::date)
        GROUP BY ar.student_id
      )
      SELECT
        s.id,
        s.full_name,
        s.student_id,
        s.section,
        0::int AS current_streak,
        0::int AS longest_streak,
        tm.total_points,
        '[]'::text AS badges,
        tm.classes_attended,
        ROW_NUMBER() OVER (ORDER BY tm.total_points DESC, tm.classes_attended DESC, s.full_name ASC) AS rank
      FROM term_marks tm
      INNER JOIN students s ON s.id = tm.student_id
      ORDER BY rank
      LIMIT ${cap}
    `) as TermLeaderboardRow[]
  }
}

