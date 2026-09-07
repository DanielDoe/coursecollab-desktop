import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { resolvePlaygroundClassroomInstructorScopeSql } from "@/lib/instructor-default-courses"
import { sqlPlaygroundTermScope } from "@/lib/playground-instructor-scope"
import { logPlaygroundDeleteAudit } from "@/lib/playground-delete-audit"
import { clearPlaygroundSessionAttempts } from "@/lib/playground-session-reset"

export const dynamic = "force-dynamic"

/**
 * POST - Clear student attempts for one playground session so they can rejoin.
 */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = await request.json().catch(() => ({}))
    const sessionId = Number(body.sessionId)
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    const psScope = await resolvePlaygroundClassroomInstructorScopeSql(
      "ps",
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )
    const termScope = await sqlPlaygroundTermScope(request)

    const owned = await sql`
      SELECT ps.id, ps.is_active
      FROM playground_sessions ps
      WHERE ps.id = ${sessionId}
        AND (${psScope})
        ${termScope}
      LIMIT 1
    `
    if (owned.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const isActive = Boolean(owned[0]?.is_active)
    const cleared = await clearPlaygroundSessionAttempts(sessionId)

    if (cleared.remainingResults > 0) {
      return NextResponse.json(
        {
          error: "Reset incomplete — some attempt rows could not be removed.",
          deletedResults: cleared.deletedResults,
          remainingResults: cleared.remainingResults,
        },
        { status: 500 },
      )
    }

    await logPlaygroundDeleteAudit({
      source: "api:instructor/playground/reset-attempts",
      actorId: scope.instructorId,
      actorType: "instructor",
      courseId: scope.course.id,
      sessionId,
      rowsBefore: cleared.rowsBefore,
      rowsDeleted: {
        answers: cleared.deletedAnswers,
        results: cleared.deletedResults,
      },
      metadata: { note: "instructor reset student attempts", live_session: isActive },
    })

    return NextResponse.json({
      success: true,
      message: "Session reset — scores, attempts, and leaderboard cleared. Students can join again.",
      deletedResults: cleared.deletedResults,
      deletedAnswers: cleared.deletedAnswers,
    })
  } catch (error) {
    console.error("[instructor/playground/reset-attempts]", error)
    const details = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error: "Failed to reset student attempts",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    )
  }
}
