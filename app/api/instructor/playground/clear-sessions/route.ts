import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { resolvePlaygroundClassroomInstructorScopeSql } from "@/lib/instructor-default-courses"
import { sqlPlaygroundTermScope } from "@/lib/playground-instructor-scope"
import {
  countPlaygroundRows,
  logPlaygroundDeleteAudit,
} from "@/lib/playground-delete-audit"
import {
  checkPlaygroundStudentDataDeleteAllowed,
  playgroundDeleteGuardResponse,
} from "@/lib/playground-production-guard"

export const dynamic = "force-dynamic"

/**
 * POST - Clear playground sessions scoped to the instructor course
 */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const psScope = await resolvePlaygroundClassroomInstructorScopeSql(
      "ps",
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )
    const termScope = await sqlPlaygroundTermScope(request)

    const body = await request.json().catch(() => ({}))
    const { clearActiveOnly, confirmPhrase } = body

    if (clearActiveOnly) {
      await sql`
        UPDATE playground_sessions ps
        SET is_active = false, ended_at = CURRENT_TIMESTAMP
        WHERE ps.mode = 'CLASSROOM' AND ps.is_active = true
          AND (${psScope})
          ${termScope}
      `

      const result = await sql`
        SELECT COUNT(*) as count
        FROM playground_sessions ps
        WHERE ps.mode = 'CLASSROOM'
          AND ps.is_active = false
          AND ps.ended_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute'
          AND (${psScope})
          ${termScope}
      `

      return NextResponse.json({
        success: true,
        message: `Cleared ${result[0]?.count || 0} active session(s)`,
        clearedCount: parseInt(String(result[0]?.count || "0"), 10),
      })
    }

    const rowsBefore = await countPlaygroundRows({
      courseId: scope.course.id,
      classroomOnly: true,
    })

    const guard = checkPlaygroundStudentDataDeleteAllowed({
      bulk: true,
      confirmPhrase,
      studentResultRows: rowsBefore.results,
    })
    if (guard.blocked) return playgroundDeleteGuardResponse(guard)

    await sql`
      DELETE FROM playground_answers pa
      USING playground_results pr, playground_sessions ps
      WHERE pa.result_id = pr.id
        AND pr.session_id = ps.id
        AND ps.mode = 'CLASSROOM'
        AND (${psScope})
        ${termScope}
    `

    await sql`
      DELETE FROM playground_results pr
      USING playground_sessions ps
      WHERE pr.session_id = ps.id
        AND ps.mode = 'CLASSROOM'
        AND (${psScope})
        ${termScope}
    `

    await sql`
      DELETE FROM playground_questions pq
      USING playground_sessions ps
      WHERE pq.session_id = ps.id
        AND ps.mode = 'CLASSROOM'
        AND (${psScope})
        ${termScope}
    `

    const result = await sql`
      DELETE FROM playground_sessions ps
      WHERE ps.mode = 'CLASSROOM'
        AND (${psScope})
        ${termScope}
      RETURNING ps.id
    `

    await logPlaygroundDeleteAudit({
      source: "api:instructor/playground/clear-sessions",
      actorId: scope.instructorId,
      actorType: "instructor",
      courseId: scope.course.id,
      scope: { clearActiveOnly: false, clearedSessionIds: result.map((r) => Number(r.id)) },
      rowsBefore,
      rowsDeleted: {
        answers: rowsBefore.answers,
        results: rowsBefore.results,
        questions: rowsBefore.questions,
        sessions: result.length,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Cleared ${result.length} session(s)`,
      clearedCount: result.length,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to clear sessions", details: msg }, { status: 500 })
  }
}
