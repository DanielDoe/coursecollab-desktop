import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  assessmentListCreatorIdForActor,
  loadInstructorActor,
} from "@/lib/instructor-actor-scope"
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope"
import {
  assertQuizAccessibleInCourse,
  deletedItemsCreatorFilterSql,
} from "@/lib/quiz-course-access"

function requireInstructorId(request: NextRequest): number | null {
  const raw = request.headers.get("x-instructor-id")
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export async function GET(request: NextRequest) {
  try {
    const scopeMeta = await resolveOptionalCourseScope(request)
    if (!scopeMeta.ok) return scopeMeta.response

    const instructorIdHdr = requireInstructorId(request)
    if (!instructorIdHdr) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const iid = instructorIdHdr
    const typeFilter =
      type != null && String(type).trim() !== ""
        ? `AND assessment_type = '${String(type).replace(/'/g, "''")}'`
        : ""

    const courseScoped = scopeMeta.courseId != null
    const cid = Number(scopeMeta.courseId)
    const listCreatorId = await assessmentListCreatorIdForActor(iid)
    const actor = await loadInstructorActor(iid)
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    let courseOwnerId = listCreatorId
    if (courseScoped && Number.isFinite(cid)) {
      const ownerRows = await sql`SELECT instructor_id FROM courses WHERE id = ${cid} LIMIT 1`
      courseOwnerId = Number(ownerRows[0]?.instructor_id ?? listCreatorId)
    }
    const creatorFilter = deletedItemsCreatorFilterSql(actor, iid, courseOwnerId)
    const creatorFilterNoCourse = deletedItemsCreatorFilterSql(actor, iid, listCreatorId)

    const deletedRows =
      courseScoped && Number.isFinite(cid)
        ? await sql.unsafe(`
      SELECT *
      FROM quizzes
      WHERE deleted_at IS NOT NULL
      ${typeFilter}
      AND ${creatorFilter}
      AND (
        course_id = ${cid}
        OR EXISTS (
          SELECT 1
          FROM quiz_session_access qsa
          INNER JOIN sessions sess ON sess.id = qsa.session_id
          WHERE qsa.quiz_id = quizzes.id AND sess.course_id = ${cid}
        )
      )
      ORDER BY deleted_at DESC
    `)
        : await sql.unsafe(`
      SELECT *
      FROM quizzes
      WHERE deleted_at IS NOT NULL
      ${typeFilter}
      AND ${creatorFilterNoCourse}
      ORDER BY deleted_at DESC
    `)

    const deletedItems = Array.isArray(deletedRows) ? deletedRows : []

    return NextResponse.json({
      deleted_items: deletedItems,
      count: deletedItems.length,
    })
  } catch (error) {
    console.error("[Deleted Items] Failed to fetch:", error)
    return NextResponse.json({
      deleted_items: [],
      count: 0,
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scopeMeta = await resolveOptionalCourseScope(request)
    if (!scopeMeta.ok) return scopeMeta.response

    const instructorIdHdr = requireInstructorId(request)
    if (!instructorIdHdr) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { quiz_id } = await request.json()
    if (!quiz_id) {
      return NextResponse.json({ error: "Quiz ID is required" }, { status: 400 })
    }

    const access = await assertQuizAccessibleInCourse(request, Number(quiz_id), {
      includeDeleted: true,
    })
    if (!access.ok) return access.response

    const result = await sql`
      UPDATE quizzes
      SET deleted_at = NULL, deleted_by = NULL
      WHERE id = ${quiz_id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: "Quiz restored successfully",
      quiz: result[0],
    })
  } catch (error) {
    console.error("[Deleted Items] Failed to restore:", error)
    return NextResponse.json({ error: "Failed to restore quiz" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scopeMeta = await resolveOptionalCourseScope(request)
    if (!scopeMeta.ok) return scopeMeta.response

    const instructorIdHdr = requireInstructorId(request)
    if (!instructorIdHdr) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { quiz_id } = await request.json()
    if (!quiz_id) {
      return NextResponse.json({ error: "Quiz ID is required" }, { status: 400 })
    }

    const access = await assertQuizAccessibleInCourse(request, Number(quiz_id), {
      includeDeleted: true,
    })
    if (!access.ok) return access.response

  // quiz_results was removed long ago; cascade attempts + answers before quiz row.
    await sql`
      DELETE FROM quiz_answers
      WHERE attempt_id IN (SELECT id FROM quiz_attempts WHERE quiz_id = ${quiz_id})
    `
    await sql`DELETE FROM quiz_attempts WHERE quiz_id = ${quiz_id}`
    await sql`DELETE FROM quiz_questions WHERE quiz_id = ${quiz_id}`
    await sql`DELETE FROM quiz_session_access WHERE quiz_id = ${quiz_id}`
    await sql`DELETE FROM quizzes WHERE id = ${quiz_id}`

    return NextResponse.json({
      success: true,
      message: "Quiz permanently deleted",
    })
  } catch (error) {
    console.error("[Deleted Items] Failed to permanently delete:", error)
    return NextResponse.json({ error: "Failed to permanently delete quiz" }, { status: 500 })
  }
}
