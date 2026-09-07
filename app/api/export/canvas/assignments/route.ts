import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { CANVAS_EXTRA_EXPORT_COLUMNS } from "@/lib/canvas-extra-export-columns"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { loadQuizAccessActor, sqlQuizVisibleInCourse } from "@/lib/quiz-course-access"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/export/canvas/assignments?section=All|ELEG1301P01
 * Quizzes the instructor owns that have at least one completed attempt,
 * optionally limited to attempts by students in that section (variant codes + `sessions` join; survives renames).
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

    const sectionRaw = request.nextUrl.searchParams.get("section")
    const sectionFilter = String(sectionRaw ?? "All").trim() || "All"
    const sectionAll = sectionFilter.toLowerCase() === "all"
    const sectionVariants = sectionAll ? [] : normalizedSectionVariantsForSql(sectionFilter)

    const rows = sectionAll
      ? await sql`
          SELECT DISTINCT q.id, q.title
          FROM quizzes q
          INNER JOIN quiz_attempts qa ON qa.quiz_id = q.id
          WHERE q.deleted_at IS NULL
            AND ${sqlQuizVisibleInCourse("q", actor, instId, courseOwnerId, courseId)}
            AND qa.deleted_at IS NULL
            AND (
              qa.completed_at IS NOT NULL
              OR COALESCE(qa.is_final_grade, false) = true
            )
          ORDER BY q.title ASC
        `
      : await sql`
          SELECT DISTINCT q.id, q.title
          FROM quizzes q
          INNER JOIN quiz_attempts qa ON qa.quiz_id = q.id
          INNER JOIN students s ON s.id = qa.student_id
          WHERE q.deleted_at IS NULL
            AND ${sqlQuizVisibleInCourse("q", actor, instId, courseOwnerId, courseId)}
            AND qa.deleted_at IS NULL
            AND (
              qa.completed_at IS NOT NULL
              OR COALESCE(qa.is_final_grade, false) = true
            )
            AND (
              TRIM(s.section) = ANY(${sectionVariants}::text[])
              OR EXISTS (
                SELECT 1 FROM sessions sess
                WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionVariants}::text[])
              )
            )
          ORDER BY q.title ASC
        `

    const quizList = (rows as { id: number; title: string }[]).map((r) => ({
      id: r.id,
      title: r.title,
    }))

    const extras = CANVAS_EXTRA_EXPORT_COLUMNS.map((c) => ({ id: c.id, title: c.title }))
    const quizzes = [...quizList, ...extras].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    )

    return NextResponse.json(
      { quizzes },
      { headers: { "Cache-Control": "no-store, must-revalidate" } },
    )
  } catch (e: unknown) {
    console.error("[export/canvas/assignments]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load assignments" },
      { status: 500 },
    )
  }
}
