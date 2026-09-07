import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  getPlaygroundSessionsScopeColumns,
  resolvePlaygroundClassroomInstructorScopeSql,
} from "@/lib/instructor-default-courses"
import { requireInstructorSession } from "@/lib/instructor-session-auth"

export const dynamic = "force-dynamic"

async function deactivateScopedClassroomSessions(
  instructorId: number,
  courseId: number | null,
  courseCode: string | null,
) {
  if (courseId != null && Number.isFinite(courseId) && courseId > 0) {
    const psScope = await resolvePlaygroundClassroomInstructorScopeSql(
      "ps",
      courseId,
      instructorId,
      courseCode,
    )
    await sql`
      UPDATE playground_sessions ps
      SET is_active = false, ended_at = CURRENT_TIMESTAMP
      WHERE ps.mode = 'CLASSROOM' AND ps.is_active = true
        AND (${psScope})
    `
    return
  }

  const cols = await getPlaygroundSessionsScopeColumns()
  if (cols.hasInstructorId) {
    await sql`
      UPDATE playground_sessions
      SET is_active = false, ended_at = CURRENT_TIMESTAMP
      WHERE mode = 'CLASSROOM' AND is_active = true
        AND instructor_id = ${instructorId}
    `
    return
  }
  if (cols.hasCourseId) {
    await sql`
      UPDATE playground_sessions
      SET is_active = false, ended_at = CURRENT_TIMESTAMP
      WHERE mode = 'CLASSROOM' AND is_active = true
        AND course_id IN (
          SELECT id FROM courses
          WHERE instructor_id = ${instructorId} AND is_active = true
        )
    `
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    let courseId: number | null = null
    let courseCode: string | null = null
    if (request.headers.get("x-course-id")?.trim()) {
      const course = await requireInstructorCourse(request)
      if (!course.ok) return course.response
      courseId = course.course.id
      courseCode = course.course.course_code
    } else {
      const rows = await sql`
        SELECT id, course_code FROM courses
        WHERE instructor_id = ${session.instructorId} AND is_active = true
        ORDER BY id ASC
        LIMIT 1
      `
      if (rows.length > 0) {
        courseId = Number(rows[0].id)
        courseCode = rows[0].course_code != null ? String(rows[0].course_code) : null
      }
    }

    const { durationSec, topics, questionCount } = await request.json()

    await deactivateScopedClassroomSessions(session.instructorId, courseId, courseCode)

    const newSession = await sql`
      INSERT INTO playground_sessions (
        mode, 
        duration_sec, 
        is_active, 
        selected_topics, 
        question_count,
        current_question_index
      )
      VALUES (
        'CLASSROOM', 
        ${durationSec || 10}, 
        true, 
        ${topics || []}, 
        ${questionCount || 10},
        0
      )
      RETURNING id, session_code, duration_sec, selected_topics, question_count, created_at
    `

    const sessionId = newSession[0].id
    const sessionCode = newSession[0].session_code

    const questionResult = await sql`
      SELECT populate_playground_questions(
        ${sessionId}::INTEGER,
        ${topics || null}::TEXT[],
        ${questionCount || 10}::INTEGER
      ) as questions_added
    `

    const questionsAdded = questionResult[0].questions_added

    if (questionsAdded === 0) {
      await sql`
        DELETE FROM playground_sessions WHERE id = ${sessionId}
      `
      return NextResponse.json({ error: "No questions found for selected topics" }, { status: 400 })
    }

    return NextResponse.json({
      sessionId,
      sessionCode,
      durationSec: newSession[0].duration_sec,
      topics: newSession[0].selected_topics,
      questionCount: newSession[0].question_count,
      questionsAdded,
      createdAt: newSession[0].created_at,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to start session" }, { status: 500 })
  }
}
