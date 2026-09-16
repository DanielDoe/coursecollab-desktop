/**
 * Shared loader for instructor attendance gradebook rows (`student_grades.attendance_score`).
 * Uses `sql.unsafe` only for validated numeric course-id fragments (never user strings).
 */
import { sql } from "@/lib/db"
import { instructorOwnsSectionVariants } from "@/lib/instructor-section-auth"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { studentInInstructorSessionScopeSql } from "@/lib/instructor-session-scope"

export type AttendanceGradebookExportRow = {
  studentId: number
  studentName: string
  studentNumber: string
  section: string
  gradeSession: string
  attendanceScore: number
  lastCalculatedAt: string | null
}

export async function loadAttendanceGradebookRowsRaw(args: {
  instructorId: number
  sectionRaw: string
  courseId: number | null
  academicTermId?: number | null
  sessionId?: number | null
}): Promise<Record<string, unknown>[] | null> {
  const { instructorId, sectionRaw, courseId, academicTermId, sessionId } = args
  const variants = normalizedSectionVariantsForSql(sectionRaw)
  if (variants.length === 0) return []

  const ownsSection = await instructorOwnsSectionVariants(instructorId, variants, courseId)
  if (!ownsSection) return null

  const sessionScopeFrag =
    courseId != null
      ? sql.unsafe(`
      AND ${studentInInstructorSessionScopeSql({
        courseId,
        sessionId: sessionId ?? null,
        academicTermId: sessionId != null ? null : (academicTermId ?? null),
        studentAlias: "s",
      })}`)
      : sql.unsafe("")

  const rows = await sql`
      SELECT DISTINCT ON (s.id)
        s.id AS student_id,
        s.full_name AS student_name,
        s.student_id AS student_number,
        s.section,
        sg.session AS grade_session,
        sg.attendance_score::numeric AS attendance_score,
        sg.last_calculated_at AS last_calculated_at
      FROM students s
      INNER JOIN student_grades sg ON sg.student_id = s.id AND sg.attendance_score IS NOT NULL
      WHERE (
          TRIM(sg.session) = ANY(${variants}::text[])
          OR TRIM(sg.session) = 'ALL'
        )
        AND (
          ${
            sessionId != null
              ? sql.unsafe(`s.session_id = ${Math.trunc(sessionId)}`)
              : sql.unsafe(`(
          TRIM(s.section) = ANY(${variants}::text[])
          OR EXISTS (
            SELECT 1 FROM sessions sess
            WHERE sess.id = s.session_id
              AND TRIM(sess.code) = ANY(${variants}::text[])
              AND (
                sess.academic_term_id IS NULL
                OR EXISTS (
                  SELECT 1 FROM academic_terms at
                  WHERE at.id = sess.academic_term_id
                    AND COALESCE(at.is_active, false) = true
                )
              )
          )
        )`)
          }
        )
        ${sessionScopeFrag}
      ORDER BY
        s.id,
        CASE
          WHEN TRIM(sg.session) = ANY(${variants}::text[]) THEN 0
          WHEN TRIM(sg.session) = 'ALL' THEN 1
          ELSE 2
        END,
        sg.last_calculated_at DESC NULLS LAST,
        sg.id DESC
    `

  return rows as Record<string, unknown>[]
}

export function mapAttendanceGradebookRow(r: Record<string, unknown>): AttendanceGradebookExportRow {
  return {
    studentId: Number(r.student_id),
    studentName: String(r.student_name ?? ""),
    studentNumber: String(r.student_number ?? ""),
    section: String(r.section ?? ""),
    gradeSession: String(r.grade_session ?? ""),
    attendanceScore: Math.min(100, Math.max(0, Number(r.attendance_score) || 0)),
    lastCalculatedAt: r.last_calculated_at != null ? String(r.last_calculated_at) : null,
  }
}

export function mergeAttendanceGradebookRow(
  existing: AttendanceGradebookExportRow | undefined,
  incoming: AttendanceGradebookExportRow,
): AttendanceGradebookExportRow {
  if (!existing) return incoming
  const t0 = existing.lastCalculatedAt ? Date.parse(existing.lastCalculatedAt) : 0
  const t1 = incoming.lastCalculatedAt ? Date.parse(incoming.lastCalculatedAt) : 0
  if (t1 > t0) return incoming
  if (t1 < t0) return existing
  if (existing.gradeSession === "ALL" && incoming.gradeSession !== "ALL") return incoming
  if (incoming.gradeSession === "ALL" && existing.gradeSession !== "ALL") return existing
  return incoming
}
