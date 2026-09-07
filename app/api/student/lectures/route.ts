import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  elegSharedLectureStudentBundleSql,
  hasLectureSessionAccessTable,
  isElegSharedLectureCourseCode,
} from "@/lib/instructor-default-courses"
import { requireStudentLectureCaller } from "@/lib/require-student-lecture-auth"
import {
  legacyLectureSessionAccessSqlFragment,
  studentLectureNoSessionLsaSqlFragment,
} from "@/lib/student-lecture-access"
import { redactStudentLectureRecords } from "@/lib/student-lecture-redact"
import { applySignedLectureDeckUrlsToRows } from "@/lib/lecture-deck-signed-url"

export const dynamic = "force-dynamic"
export const revalidate = 10

/**
 * Non‑BETA students:
 * - If `lecture_session_access` exists → active row for the student's session, OR legacy rules when
 *   no junction row exists for that session yet (Fall 2026 shares section codes with Spring).
 * - If that table is missing → legacy `course_id` / `session_access` rules apply.
 * - Lectures stored on LEGACY / ELEG1301 / ELEG1304 for the same instructor are shared.
 */
export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    const week = request.nextUrl.searchParams.get("week")

    const auth = await requireStudentLectureCaller(request, studentId)
    if (!auth.ok) return auth.response

    const row = auth.sessionRow

    const studentDbId = row.id
    const sessionId = row.session_id
    const sessCourseId = row.session_course_id
    const sessionInstructorId = row.session_instructor_id
    const isBetaStudent =
      row.section.toUpperCase().includes("BETA") || row.session_code.toUpperCase().includes("BETA")

    const elegSharedForStudent =
      sessionInstructorId != null && isElegSharedLectureCourseCode(row.session_course_code)
        ? elegSharedLectureStudentBundleSql(sessionInstructorId)
        : sql.unsafe("(FALSE)")

    const legacyAccess = legacyLectureSessionAccessSqlFragment(sessionId)
    const legacyWhenNoSessionLsa = studentLectureNoSessionLsaSqlFragment(sessionId)
    const hasLsa = await hasLectureSessionAccessTable()

    const lectures = !hasLsa
      ? week
        ? await sql`
            SELECT
              l.*,
              COALESCE(lsp.last_viewed_slide_order, 0) as current_slide,
              COALESCE(lsp.completed_slides, '[]'::jsonb) as completed_slides,
              0 as xp_earned,
              lsp.completed_at,
              lsp.last_accessed,
              COALESCE(lsp.status, 'not_started') as status,
              COALESCE(lsp.progress_percentage, 0) as progress_percentage,
              COALESCE(lsp.bookmarked_slides, '[]'::jsonb) as bookmarked_slides
            FROM lectures l
            LEFT JOIN lecture_student_progress lsp ON l.id = lsp.lecture_id AND lsp.student_id = ${studentDbId}
            WHERE l.week = ${parseInt(week, 10)}
              AND l.deleted_at IS NULL
              AND COALESCE(l.is_published, true) IS NOT DISTINCT FROM TRUE
              AND (
                ${isBetaStudent}
                OR (
                  (
                    l.course_id IS NULL
                    OR l.course_id IS NOT DISTINCT FROM ${sessCourseId}
                    OR (${elegSharedForStudent})
                  )
                  AND (${legacyAccess})
                )
              )
            ORDER BY l.created_at ASC
          `
        : await sql`
            SELECT
              l.*,
              COALESCE(lsp.last_viewed_slide_order, 0) as current_slide,
              COALESCE(lsp.completed_slides, '[]'::jsonb) as completed_slides,
              0 as xp_earned,
              lsp.completed_at,
              lsp.last_accessed,
              COALESCE(lsp.status, 'not_started') as status,
              COALESCE(lsp.progress_percentage, 0) as progress_percentage,
              COALESCE(lsp.bookmarked_slides, '[]'::jsonb) as bookmarked_slides
            FROM lectures l
            LEFT JOIN lecture_student_progress lsp ON l.id = lsp.lecture_id AND lsp.student_id = ${studentDbId}
            WHERE l.deleted_at IS NULL
              AND COALESCE(l.is_published, true) IS NOT DISTINCT FROM TRUE
              AND (
                ${isBetaStudent}
                OR (
                  (
                    l.course_id IS NULL
                    OR l.course_id IS NOT DISTINCT FROM ${sessCourseId}
                    OR (${elegSharedForStudent})
                  )
                  AND (${legacyAccess})
                )
              )
            ORDER BY l.week ASC, l.created_at ASC
          `
      : week
        ? await sql`
            SELECT
              l.*,
              COALESCE(lsp.last_viewed_slide_order, 0) as current_slide,
              COALESCE(lsp.completed_slides, '[]'::jsonb) as completed_slides,
              0 as xp_earned,
              lsp.completed_at,
              lsp.last_accessed,
              COALESCE(lsp.status, 'not_started') as status,
              COALESCE(lsp.progress_percentage, 0) as progress_percentage,
              COALESCE(lsp.bookmarked_slides, '[]'::jsonb) as bookmarked_slides
            FROM lectures l
            LEFT JOIN lecture_student_progress lsp ON l.id = lsp.lecture_id AND lsp.student_id = ${studentDbId}
            WHERE l.week = ${parseInt(week, 10)}
              AND l.deleted_at IS NULL
              AND COALESCE(l.is_published, true) IS NOT DISTINCT FROM TRUE
              AND (
                ${isBetaStudent}
                OR EXISTS (
                  SELECT 1 FROM lecture_session_access lsa
                  WHERE lsa.lecture_id = l.id
                    AND lsa.is_active = true
                    AND ${sessionId} IS NOT NULL
                    AND lsa.session_id = ${sessionId}
                )
                OR (
                  (${legacyWhenNoSessionLsa})
                  AND (
                    l.course_id IS NULL
                    OR l.course_id IS NOT DISTINCT FROM ${sessCourseId}
                    OR (${elegSharedForStudent})
                  )
                  AND (${legacyAccess})
                )
              )
            ORDER BY l.created_at ASC
          `
        : await sql`
            SELECT
              l.*,
              COALESCE(lsp.last_viewed_slide_order, 0) as current_slide,
              COALESCE(lsp.completed_slides, '[]'::jsonb) as completed_slides,
              0 as xp_earned,
              lsp.completed_at,
              lsp.last_accessed,
              COALESCE(lsp.status, 'not_started') as status,
              COALESCE(lsp.progress_percentage, 0) as progress_percentage,
              COALESCE(lsp.bookmarked_slides, '[]'::jsonb) as bookmarked_slides
            FROM lectures l
            LEFT JOIN lecture_student_progress lsp ON l.id = lsp.lecture_id AND lsp.student_id = ${studentDbId}
            WHERE l.deleted_at IS NULL
              AND COALESCE(l.is_published, true) IS NOT DISTINCT FROM TRUE
              AND (
                ${isBetaStudent}
                OR EXISTS (
                  SELECT 1 FROM lecture_session_access lsa
                  WHERE lsa.lecture_id = l.id
                    AND lsa.is_active = true
                    AND ${sessionId} IS NOT NULL
                    AND lsa.session_id = ${sessionId}
                )
                OR (
                  (${legacyWhenNoSessionLsa})
                  AND (
                    l.course_id IS NULL
                    OR l.course_id IS NOT DISTINCT FROM ${sessCourseId}
                    OR (${elegSharedForStudent})
                  )
                  AND (${legacyAccess})
                )
              )
            ORDER BY l.week ASC, l.created_at ASC
          `

    return NextResponse.json({
      lectures: applySignedLectureDeckUrlsToRows(
        redactStudentLectureRecords(lectures as Record<string, unknown>[]),
        { studentDbId, origin: request.nextUrl.origin },
      ),
    })
  } catch (error) {
    console.error("[Student Lectures API] Error fetching lectures:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch lectures",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
