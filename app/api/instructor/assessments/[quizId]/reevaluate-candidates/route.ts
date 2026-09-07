import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { listAttemptSummariesForQuizReevaluate } from "@/lib/assessment-pnd-helpers"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { requireInstructorGradingAccess } from "@/lib/instructor-grading-auth"

export const dynamic = "force-dynamic"

/**
 * GET ?scope=all|pending&sessionCode= — optional session filter (class roster only).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const gradingAuth = await requireInstructorGradingAccess(request)
    if (!gradingAuth.ok) return gradingAuth.response

    const { quizId: quizIdStr } = await params
    const quizId = Number.parseInt(quizIdStr, 10)
    if (Number.isNaN(quizId)) {
      return NextResponse.json({ error: "Invalid quiz id" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const scope = searchParams.get("scope") === "pending" ? "pending" : "all"
    const sessionCodeRaw = searchParams.get("sessionCode")?.trim()
    let sessionId: number | undefined
    if (sessionCodeRaw) {
      const variants = normalizedSectionVariantsForSql(sessionCodeRaw)
      const sess =
        variants.length > 0
          ? await sql`
              SELECT id FROM sessions
              WHERE TRIM(code) = ANY(${variants}::text[])
              ORDER BY CASE WHEN code LIKE 'ELEG%' THEN 0 ELSE 1 END, code
              LIMIT 1
            `
          : []
      if (sess.length === 0) {
        return NextResponse.json({ error: `Unknown session code: ${sessionCodeRaw}` }, { status: 400 })
      }
      sessionId = Number((sess[0] as { id: number }).id)
    }

    const attempts = await listAttemptSummariesForQuizReevaluate(quizId, scope, {
      skipInstructorOverrides: true,
      ...(sessionId != null ? { sessionId } : {}),
    })
    const attemptIds = attempts.map((a) => a.id)

    return NextResponse.json({
      quizId,
      scope,
      sessionCode: sessionCodeRaw ?? null,
      sessionId: sessionId ?? null,
      count: attempts.length,
      attemptIds,
      attempts,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[reevaluate-candidates]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
