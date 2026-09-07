import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { instructorMirrorBetaStudentsAcrossCourses } from "@/lib/instructor-beta-mirror-scope"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"
import { studentInInstructorSessionScopeSql } from "@/lib/instructor-session-scope"
import {
  fetchInstructorStudentsBySessionCode,
  fetchInstructorStudentsBySessionCodeAndQuiz,
  fetchInstructorStudentsBySessionId,
} from "@/lib/instructor-students-session-query"

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const platformCourseId = scope.course.id
    const instructorIdForMirror = scope.instructorId
    const sessionScope = readInstructorSessionScopeFromRequest(request)

    const { searchParams } = new URL(request.url)
    const sessionCode = searchParams.get("sessionCode")
    const sessionIdParam = searchParams.get("session_id")
    const quizId = searchParams.get("quizId")

    let students

    if (sessionCode && quizId) {
      const isNumericQuizId = /^\d+$/.test(quizId)
      const quizParam: number | string = isNumericQuizId ? Number(quizId) : quizId
      students = await fetchInstructorStudentsBySessionCodeAndQuiz(
        platformCourseId,
        sessionCode,
        sessionScope.academicTermId,
        quizParam,
      )
    } else if (sessionScope.sessionId != null && (sessionCode || sessionIdParam)) {
      students = await fetchInstructorStudentsBySessionId(platformCourseId, sessionScope.sessionId)
    } else if (sessionCode) {
      students = await fetchInstructorStudentsBySessionCode(
        platformCourseId,
        sessionCode,
        sessionScope.academicTermId,
      )
    } else if (sessionIdParam && sessionIdParam !== "all") {
      const parsedSessionId = Number.parseInt(sessionIdParam, 10)
      students = Number.isFinite(parsedSessionId)
        ? await fetchInstructorStudentsBySessionId(platformCourseId, parsedSessionId)
        : []
    } else {
      const scopedStudentSql = studentInInstructorSessionScopeSql({
        courseId: platformCourseId,
        sessionId: sessionScope.sessionId,
        academicTermId: sessionScope.academicTermId,
      })
      const mirrorBetaCrossCourse = instructorMirrorBetaStudentsAcrossCourses()
      students = mirrorBetaCrossCourse
        ? await sql`
        SELECT
          s.id,
          s.student_id,
          s.full_name,
          s.email,
          s.section,
          COALESCE(s.created_at, CURRENT_TIMESTAMP) as created_at,
          sess.code as session_code,
          sess.description as session_description,
          COALESCE(qa_counts.cnt, 0)::int as quiz_attempts
        FROM students s
        JOIN sessions sess ON sess.id = s.session_id
        LEFT JOIN (
          SELECT student_id, COUNT(*)::int as cnt
          FROM quiz_attempts
          GROUP BY student_id
        ) qa_counts ON qa_counts.student_id = s.id
        WHERE (
          (${sql.unsafe(scopedStudentSql)})
          OR (
            (
              COALESCE(s.beta_user, false) = true
              OR TRIM(UPPER(COALESCE(s.section, ''))) = 'BETA'
            )
            AND EXISTS (
              SELECT 1 FROM courses bc
              INNER JOIN sessions bx ON bx.course_id = bc.id AND bx.id = s.session_id
              WHERE bc.instructor_id = ${instructorIdForMirror} AND bc.is_active = true
            )
          )
        )
        ORDER BY s.full_name
      `
        : await sql`
        SELECT
          s.id,
          s.student_id,
          s.full_name,
          s.email,
          s.section,
          COALESCE(s.created_at, CURRENT_TIMESTAMP) as created_at,
          sess.code as session_code,
          sess.description as session_description,
          COALESCE(qa_counts.cnt, 0)::int as quiz_attempts
        FROM students s
        JOIN sessions sess ON sess.id = s.session_id
        LEFT JOIN (
          SELECT student_id, COUNT(*)::int as cnt
          FROM quiz_attempts
          GROUP BY student_id
        ) qa_counts ON qa_counts.student_id = s.id
        WHERE ${sql.unsafe(scopedStudentSql)}
        ORDER BY s.full_name
      `
    }

    return NextResponse.json({ students })
  } catch (error) {
    console.error("[Instructor Students] Failed to fetch students:", error)
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 })
  }
}