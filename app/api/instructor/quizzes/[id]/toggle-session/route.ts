import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveAllSessionRowsByCode } from "@/lib/resolve-session-by-code"
import { getActorCoursePermissionCodes, requireCoursePermission } from "@/lib/course-permission-guard"
import { ensureQuizSessionTaVisibleColumn } from "@/lib/ensure-quiz-session-ta-visible"
import { buildQuizReleaseTargets } from "@/lib/quiz-release-targets"
import { assertQuizAccessibleInCourse } from "@/lib/quiz-course-access"

export const dynamic = "force-dynamic"

async function syncQuizTaVisibilityForCourse(quizId: number, taVisible: boolean): Promise<void> {
  const meta = await sql`
    SELECT q.course_id, c.course_code
    FROM quizzes q
    LEFT JOIN courses c ON c.id = q.course_id
    WHERE q.id = ${quizId}
    LIMIT 1
  `
  if (meta.length === 0) return
  const courseId = (meta[0] as { course_id: number | null }).course_id
  const courseCode = String((meta[0] as { course_code: string | null }).course_code ?? "")
  if (!courseId) return

  const sessionRows = await sql`
    SELECT id, code FROM sessions WHERE course_id = ${courseId}
  `
  const targets = buildQuizReleaseTargets(
    sessionRows as { id: number; code: string }[],
    courseCode,
  )
  for (const target of targets) {
    await sql`
      INSERT INTO quiz_session_access (quiz_id, session_id, is_active, ta_visible, updated_at)
      VALUES (${quizId}, ${target.sessionId}, false, ${taVisible}, CURRENT_TIMESTAMP)
      ON CONFLICT (quiz_id, session_id)
      DO UPDATE SET
        ta_visible = ${taVisible},
        updated_at = CURRENT_TIMESTAMP
    `
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const session_code = body.session_code as string | undefined
    const is_active = body.is_active as boolean | undefined
    const ta_visible = body.ta_visible as boolean | undefined
    const { id: quizId } = await params

    const access = await assertQuizAccessibleInCourse(request, Number(quizId))
    if (!access.ok) return access.response

    if (is_active === undefined && ta_visible === undefined) {
      return NextResponse.json({ error: "Provide is_active and/or ta_visible" }, { status: 400 })
    }

    await ensureQuizSessionTaVisibleColumn()

    if (is_active !== undefined) {
      if (!session_code) {
        return NextResponse.json({ error: "session_code required for student release" }, { status: 400 })
      }

      const ctx = await requireCoursePermission(request, ["publish_quizzes", "publish_homework"], "You need publish access to release assessments to students.")
      if (!ctx.ok) return ctx.response

      const sessionRows = await resolveAllSessionRowsByCode(String(session_code), access.course.id)
      if (sessionRows.length === 0) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }

      for (const session of sessionRows) {
        await sql`
          INSERT INTO quiz_session_access (quiz_id, session_id, is_active, updated_at)
          VALUES (${quizId}, ${session.id}, ${is_active}, CURRENT_TIMESTAMP)
          ON CONFLICT (quiz_id, session_id)
          DO UPDATE SET
            is_active = ${is_active},
            updated_at = CURRENT_TIMESTAMP
        `
      }
    }

    if (ta_visible !== undefined) {
      const ctx = await getActorCoursePermissionCodes(request)
      if (!ctx.ok) return ctx.response
      if (!ctx.isInstructorOwner) {
        return NextResponse.json(
          { error: "Only the supervising instructor can change TA visibility for this assessment." },
          { status: 403 },
        )
      }

      if (!session_code) {
        await syncQuizTaVisibilityForCourse(Number(quizId), ta_visible)
      } else {
        const sessionRows = await resolveAllSessionRowsByCode(String(session_code), access.course.id)
        if (sessionRows.length === 0) {
          return NextResponse.json({ error: "Session not found" }, { status: 404 })
        }
        for (const session of sessionRows) {
          await sql`
            INSERT INTO quiz_session_access (quiz_id, session_id, is_active, ta_visible, updated_at)
            VALUES (${quizId}, ${session.id}, false, ${ta_visible}, CURRENT_TIMESTAMP)
            ON CONFLICT (quiz_id, session_id)
            DO UPDATE SET
              ta_visible = ${ta_visible},
              updated_at = CURRENT_TIMESTAMP
          `
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Toggle Session] Failed:", error)
    return NextResponse.json({ error: "Failed to toggle quiz session" }, { status: 500 })
  }
}
