import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { claimedStudentIdFromPlaygroundRequest } from "@/lib/playground-request-auth"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { resolveStudentCourseContextFromRequest } from "@/lib/student-course-scope"
import { getPlaygroundSessionsScopeColumns } from "@/lib/instructor-default-courses"

export const dynamic = "force-dynamic"

function sessionLabelFromTopics(selectedTopics: string[] | null, sessionCode: string): string {
  const topics = selectedTopics ?? []
  const setLabel = topics.find((t) => t.includes("Playground Set"))
  if (setLabel) return setLabel
  if (topics.length > 0) return topics[0]
  return sessionCode || "Practice Set"
}

/** Student-readable list of solo practice playground sets (seeded templates with questions). */
export async function GET(request: NextRequest) {
  try {
    const bound = await requireBoundStudentCaller(
      request,
      claimedStudentIdFromPlaygroundRequest(request),
    )
    if (!bound.ok) return bound.response

    const scope = await resolveStudentCourseContextFromRequest(request)
    if (!scope.ok) return scope.response

    const scopeCols = await getPlaygroundSessionsScopeColumns()
    const { courseId, sessionId: studentSessionId } = scope.ctx

    type Row = {
      id: number
      session_code: string
      selected_topics: string[] | null
      question_count: number | null
      duration_sec: number
      allowed_sessions: number[] | null
      question_count_actual: number
    }

    const sessions = scopeCols.hasCourseId
      ? await sql<Row>`
          SELECT
            ps.id,
            ps.session_code,
            ps.selected_topics,
            ps.question_count,
            ps.duration_sec,
            ps.allowed_sessions,
            COUNT(pq.id)::int AS question_count_actual
          FROM playground_sessions ps
          INNER JOIN playground_questions pq ON pq.session_id = ps.id
          WHERE ps.mode = 'CLASSROOM'
            AND ps.course_id = ${courseId}
          GROUP BY
            ps.id,
            ps.session_code,
            ps.selected_topics,
            ps.question_count,
            ps.duration_sec,
            ps.allowed_sessions
          HAVING COUNT(pq.id) > 0
          ORDER BY ps.selected_topics, ps.id
        `
      : await sql<Row>`
          SELECT
            ps.id,
            ps.session_code,
            ps.selected_topics,
            ps.question_count,
            ps.duration_sec,
            ps.allowed_sessions,
            COUNT(pq.id)::int AS question_count_actual
          FROM playground_sessions ps
          INNER JOIN playground_questions pq ON pq.session_id = ps.id
          WHERE ps.mode = 'CLASSROOM'
          GROUP BY
            ps.id,
            ps.session_code,
            ps.selected_topics,
            ps.question_count,
            ps.duration_sec,
            ps.allowed_sessions
          HAVING COUNT(pq.id) > 0
          ORDER BY ps.selected_topics, ps.id
        `

    const practiceSets = sessions
      .filter((row) => {
        if (
          row.allowed_sessions !== null &&
          Array.isArray(row.allowed_sessions) &&
          row.allowed_sessions.length > 0 &&
          studentSessionId !== null &&
          !row.allowed_sessions.includes(studentSessionId)
        ) {
          return false
        }
        return true
      })
      .map((row) => ({
        id: row.id,
        label: sessionLabelFromTopics(row.selected_topics, row.session_code),
        topics: row.selected_topics ?? [],
        questionCount: Number(row.question_count_actual) || Number(row.question_count) || 0,
        durationSec: Number(row.duration_sec) || 10,
      }))

    return NextResponse.json({ practiceSets })
  } catch (error) {
    console.error("[playground/practice-sets GET]", error)
    return NextResponse.json({ error: "Failed to load practice sets" }, { status: 500 })
  }
}
