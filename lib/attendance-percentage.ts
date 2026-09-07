import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"

export type StudentAttendanceSoFar = {
  /** 0–100: classes attended ÷ sessions marked for this student (not full schedule). */
  percentage: number
  /** Same ratio scaled to 0–10 for legacy attendance widgets. */
  scoreOutOf10: number
  pointsEarned: number
  /** Sessions where this student has an attendance record (denominator). */
  sessionsScoredSoFar: number
  /** All active sessions on the section schedule (including not yet held). */
  sessionsScheduledTotal: number
  /** Scored sessions where the student earned credit (> 0 points). */
  classesAttended: number
}

const EMPTY: StudentAttendanceSoFar = {
  percentage: 0,
  scoreOutOf10: 0,
  pointsEarned: 0,
  sessionsScoredSoFar: 0,
  sessionsScheduledTotal: 0,
  classesAttended: 0,
}

type AttendanceSoFarRow = {
  points_earned: number | string
  sessions_scored_so_far: number | string
  sessions_scheduled_total: number | string
  classes_attended: number | string
  attendance_percentage: number | string
  attendance_score_10: number | string
}

function isMissingDeletedAtColumn(error: unknown): boolean {
  const err = error as { code?: string; message?: string }
  return err?.code === "42703" && (err.message?.includes("deleted_at") ?? false)
}

function mapAttendanceSoFarRow(row: AttendanceSoFarRow | undefined): StudentAttendanceSoFar {
  if (!row) return EMPTY
  return {
    percentage: Number(row.attendance_percentage) || 0,
    scoreOutOf10: Number(row.attendance_score_10) || 0,
    pointsEarned: Number(row.points_earned) || 0,
    sessionsScoredSoFar: Number(row.sessions_scored_so_far) || 0,
    sessionsScheduledTotal: Number(row.sessions_scheduled_total) || 0,
    classesAttended: Number(row.classes_attended) || 0,
  }
}

async function queryStudentAttendanceSoFar(
  studentId: number,
  sessionTrim: string,
  filterDeletedRecords: boolean,
): Promise<StudentAttendanceSoFar> {
  const rows = filterDeletedRecords
    ? sqlRows<AttendanceSoFarRow>(
        await sql`
          WITH section_ctx AS (
            SELECT
              sess.code AS section_code,
              s.course_id,
              at.start_date AS term_start,
              at.end_date AS term_end
            FROM students s
            JOIN sessions sess ON sess.id = s.session_id
            LEFT JOIN academic_terms at ON at.id = sess.academic_term_id
            WHERE s.id = ${studentId}
            LIMIT 1
          ),
          scheduled_sessions AS (
            SELECT asess.id
            FROM attendance_sessions asess
            CROSS JOIN section_ctx sc
            WHERE asess.is_active = true
              AND COALESCE(asess.is_cancelled, false) = false
              AND TRIM(asess.section) = TRIM(sc.section_code)
              AND (asess.course_id IS NULL OR asess.course_id = sc.course_id)
              AND (sc.term_start IS NULL OR asess.start_time::date >= (sc.term_start - interval '14 days')::date)
              AND (sc.term_end IS NULL OR asess.start_time::date <= sc.term_end)
              AND (
                ${sessionTrim} = ''
                OR TRIM(asess.section) = TRIM(${sessionTrim})
                OR TRIM(sc.section_code) = TRIM(${sessionTrim})
              )
          ),
          student_marked AS (
            SELECT
              ar.session_id,
              MAX(COALESCE(ar.points_earned, 0)::float) AS points_earned
            FROM attendance_records ar
            INNER JOIN scheduled_sessions ss ON ss.id = ar.session_id
            INNER JOIN attendance_sessions asess ON asess.id = ar.session_id
            WHERE ar.student_id = ${studentId}
              AND ar.deleted_at IS NULL
              AND asess.start_time <= NOW()
            GROUP BY ar.session_id
          )
          SELECT
            COALESCE((SELECT SUM(points_earned) FROM student_marked), 0)::float AS points_earned,
            (SELECT COUNT(*)::int FROM student_marked) AS sessions_scored_so_far,
            (SELECT COUNT(*)::int FROM scheduled_sessions) AS sessions_scheduled_total,
            (SELECT COUNT(*)::int FROM student_marked WHERE points_earned > 0) AS classes_attended,
            CASE
              WHEN (SELECT COUNT(*) FROM student_marked) > 0 THEN ROUND(
                (
                  COALESCE((SELECT SUM(points_earned) FROM student_marked), 0)::decimal
                  / (SELECT COUNT(*) FROM student_marked)
                ) * 100,
                2
              )
              ELSE 0
            END AS attendance_percentage,
            CASE
              WHEN (SELECT COUNT(*) FROM student_marked) > 0 THEN ROUND(
                (
                  COALESCE((SELECT SUM(points_earned) FROM student_marked), 0)::decimal
                  / (SELECT COUNT(*) FROM student_marked)
                ) * 10,
                2
              )
              ELSE 0
            END AS attendance_score_10
        `,
      )
    : sqlRows<AttendanceSoFarRow>(
        await sql`
          WITH section_ctx AS (
            SELECT
              sess.code AS section_code,
              s.course_id,
              at.start_date AS term_start,
              at.end_date AS term_end
            FROM students s
            JOIN sessions sess ON sess.id = s.session_id
            LEFT JOIN academic_terms at ON at.id = sess.academic_term_id
            WHERE s.id = ${studentId}
            LIMIT 1
          ),
          scheduled_sessions AS (
            SELECT asess.id
            FROM attendance_sessions asess
            CROSS JOIN section_ctx sc
            WHERE asess.is_active = true
              AND COALESCE(asess.is_cancelled, false) = false
              AND TRIM(asess.section) = TRIM(sc.section_code)
              AND (asess.course_id IS NULL OR asess.course_id = sc.course_id)
              AND (sc.term_start IS NULL OR asess.start_time::date >= (sc.term_start - interval '14 days')::date)
              AND (sc.term_end IS NULL OR asess.start_time::date <= sc.term_end)
              AND (
                ${sessionTrim} = ''
                OR TRIM(asess.section) = TRIM(${sessionTrim})
                OR TRIM(sc.section_code) = TRIM(${sessionTrim})
              )
          ),
          student_marked AS (
            SELECT
              ar.session_id,
              MAX(COALESCE(ar.points_earned, 0)::float) AS points_earned
            FROM attendance_records ar
            INNER JOIN scheduled_sessions ss ON ss.id = ar.session_id
            INNER JOIN attendance_sessions asess ON asess.id = ar.session_id
            WHERE ar.student_id = ${studentId}
              AND asess.start_time <= NOW()
            GROUP BY ar.session_id
          )
          SELECT
            COALESCE((SELECT SUM(points_earned) FROM student_marked), 0)::float AS points_earned,
            (SELECT COUNT(*)::int FROM student_marked) AS sessions_scored_so_far,
            (SELECT COUNT(*)::int FROM scheduled_sessions) AS sessions_scheduled_total,
            (SELECT COUNT(*)::int FROM student_marked WHERE points_earned > 0) AS classes_attended,
            CASE
              WHEN (SELECT COUNT(*) FROM student_marked) > 0 THEN ROUND(
                (
                  COALESCE((SELECT SUM(points_earned) FROM student_marked), 0)::decimal
                  / (SELECT COUNT(*) FROM student_marked)
                ) * 100,
                2
              )
              ELSE 0
            END AS attendance_percentage,
            CASE
              WHEN (SELECT COUNT(*) FROM student_marked) > 0 THEN ROUND(
                (
                  COALESCE((SELECT SUM(points_earned) FROM student_marked), 0)::decimal
                  / (SELECT COUNT(*) FROM student_marked)
                ) * 10,
                2
              )
              ELSE 0
            END AS attendance_score_10
        `,
      )

  return mapAttendanceSoFarRow(rows[0])
}

/**
 * Attendance % = classes attended ÷ sessions marked for this student.
 * Unmarked days (no record for the student) are excluded from the denominator.
 * Marked absent (0 points) still counts in the denominator.
 */
export async function getStudentAttendanceSoFar(
  studentId: number,
  session?: string,
): Promise<StudentAttendanceSoFar> {
  const sessionTrim = session != null ? String(session).trim() : ""

  try {
    return await queryStudentAttendanceSoFar(studentId, sessionTrim, true)
  } catch (error) {
    if (isMissingDeletedAtColumn(error)) {
      try {
        return await queryStudentAttendanceSoFar(studentId, sessionTrim, false)
      } catch (retryError) {
        console.error("[getStudentAttendanceSoFar]", retryError)
        return EMPTY
      }
    }
    console.error("[getStudentAttendanceSoFar]", error)
    return EMPTY
  }
}

/** Attach scored-so-far attendance stats to leaderboard/API rows. */
export async function enrichWithAttendanceSoFar<T extends { id?: number | string | null }>(
  entries: T[],
  section?: string,
): Promise<Array<T & StudentAttendanceSoFar & { attendance_percentage: number; total_classes: number; classes_attended: number }>> {
  return Promise.all(
    entries.map(async (entry) => {
      const id = Number(entry.id)
      if (!Number.isFinite(id)) {
        return {
          ...entry,
          ...EMPTY,
          attendance_percentage: 0,
          total_classes: 0,
          classes_attended: 0,
        }
      }
      const stats = await getStudentAttendanceSoFar(id, section)
      return {
        ...entry,
        ...stats,
        attendance_percentage: stats.percentage,
        total_classes: stats.sessionsScoredSoFar,
        classes_attended: stats.classesAttended,
      }
    }),
  )
}

