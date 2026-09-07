import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  isSuggestedCanvasExportExclude,
  type CanvasExportRosterStudent,
} from "@/lib/canvas-export-exclusions"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { loadQuizAccessActor, sqlQuizVisibleInCourse } from "@/lib/quiz-course-access"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/export/canvas/roster?section=ECE2202
 * Students in the section scope used by Canvas export (for exclude-from-export UI).
 */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const { instructorId: instId, course } = scope
    const accessActor = await loadQuizAccessActor(instId, course)
    if (!accessActor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { actor, courseOwnerId } = accessActor
    const courseId = course.id
    const quizCourseFilter = sqlQuizVisibleInCourse("q", actor, instId, courseOwnerId, courseId)

    const sectionRaw = request.nextUrl.searchParams.get("section")
    const sectionFilter = String(sectionRaw ?? "All").trim() || "All"
    const sectionAll = sectionFilter.toLowerCase() === "all"
    const sectionVariants = sectionAll ? [] : normalizedSectionVariantsForSql(sectionFilter)

    const rows = sectionAll
      ? await sql`
          SELECT DISTINCT ON (s.id)
            s.id,
            s.full_name,
            s.student_id,
            s.sis_user_id,
            s.beta_user,
            s.section
          FROM students s
          LEFT JOIN sessions sess ON sess.id = s.session_id
          WHERE EXISTS (
            SELECT 1 FROM quiz_attempts qa
            INNER JOIN quizzes q ON q.id = qa.quiz_id AND q.deleted_at IS NULL
            WHERE qa.student_id = s.id AND qa.deleted_at IS NULL
              AND (qa.completed_at IS NOT NULL OR COALESCE(qa.is_final_grade, false) = true)
              AND ${quizCourseFilter}
          )
          ORDER BY s.id, s.full_name ASC
        `
      : await sql`
          SELECT DISTINCT ON (s.id)
            s.id,
            s.full_name,
            s.student_id,
            s.sis_user_id,
            s.beta_user,
            s.section
          FROM students s
          LEFT JOIN sessions sess ON sess.id = s.session_id
          WHERE (
              TRIM(s.section) = ANY(${sectionVariants}::text[])
              OR EXISTS (
                SELECT 1 FROM sessions sess_f
                WHERE sess_f.id = s.session_id
                  AND TRIM(sess_f.code) = ANY(${sectionVariants}::text[])
              )
            )
            AND EXISTS (
              SELECT 1 FROM quiz_attempts qa
              INNER JOIN quizzes q ON q.id = qa.quiz_id AND q.deleted_at IS NULL
              WHERE qa.student_id = s.id AND qa.deleted_at IS NULL
                AND (qa.completed_at IS NOT NULL OR COALESCE(qa.is_final_grade, false) = true)
                AND ${quizCourseFilter}
            )
          ORDER BY s.id, s.full_name ASC
        `

    const students: CanvasExportRosterStudent[] = (rows as Array<Record<string, unknown>>).map((r) => {
      const hint = isSuggestedCanvasExportExclude({
        beta_user: r.beta_user as boolean | null,
        student_id: r.student_id as string | null,
        full_name: r.full_name as string | null,
        section: r.section as string | null,
      })
      const schoolId = String(r.student_id ?? "").trim()
      const sis = String(r.sis_user_id ?? "").trim()
      return {
        internalId: Number(r.id),
        name: String(r.full_name ?? "").trim(),
        studentId: schoolId,
        sisUserId: sis || schoolId,
        betaUser: r.beta_user === true,
        suggestedExclude: hint.exclude,
        excludeReason: hint.reason,
      }
    })

    students.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))

    return NextResponse.json(
      { students, sectionFilter },
      { headers: { "Cache-Control": "no-store, must-revalidate" } },
    )
  } catch (e: unknown) {
    console.error("[export/canvas/roster]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load roster" },
      { status: 500 },
    )
  }
}
