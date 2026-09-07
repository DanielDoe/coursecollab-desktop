import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import {
  ensureInstructorRecommendationSettings,
  logRecommendationAudit,
  type RecommendationSettingsRow,
} from "@/lib/recommendation-letters"
import { notifyRecommendationInstructor } from "@/lib/recommendation-instructor-email"
import { notifyRecommendationStudent } from "@/lib/recommendation-student-email"

export const dynamic = "force-dynamic"

/**
 * Non-AI flow: after the questionnaire, the student composes the letter body here,
 * then submits it for instructor final approval (same gates as draft selection when AI is on).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)
    const body = await request.json()
    const raw = String(body.studentDatabaseId ?? body.studentId ?? "").trim()
    const letterText = String(body.letterText ?? body.letter_text ?? "").trim()
    const bound = await requireBoundStudentCaller(request, raw || null)
    if (!bound.ok) return bound.response
    const dbId = bound.studentDbId
    if (!letterText) return NextResponse.json({ error: "Letter text is required" }, { status: 400 })

    const rows = sqlRows(
      await sql`
      SELECT r.* FROM recommendation_requests r
      WHERE r.id = ${requestId} AND r.student_id = ${dbId}
      LIMIT 1
    `,
    )
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const reqRow = rows[0] as { status: string; instructor_id: number }

    const rs = String(reqRow.status)
    if (rs !== "approved" && rs !== "revision_requested") {
      return NextResponse.json({ error: "Submit your questionnaire first, or wait for the current step." }, { status: 400 })
    }

    const prof = sqlRows(await sql`SELECT 1 FROM recommendation_profiles WHERE request_id = ${requestId} LIMIT 1`)
    if (prof.length === 0) {
      return NextResponse.json({ error: "Complete your questionnaire before submitting a letter" }, { status: 400 })
    }

    await ensureInstructorRecommendationSettings(Number(reqRow.instructor_id))
    const settingsRows = sqlRows(
      await sql`
      SELECT * FROM recommendation_settings WHERE instructor_id = ${Number(reqRow.instructor_id)} LIMIT 1
    `,
    )
    const settings = settingsRows[0] as RecommendationSettingsRow | undefined
    if (!settings) return NextResponse.json({ error: "Settings missing" }, { status: 500 })

    /** Manual letter body submission is allowed even when the instructor enables AI drafts — the student composed the text locally. */
    const needReview = Boolean(settings.require_final_review)

    if (needReview) {
      await sql`
        UPDATE recommendation_requests
        SET final_letter_text = ${letterText},
            status = 'student_selected',
            selected_draft_id = NULL,
            updated_at = NOW()
        WHERE id = ${requestId}
      `
    } else {
      await sql`
        UPDATE recommendation_requests
        SET final_letter_text = ${letterText},
            status = 'finalized',
            instructor_reviewed_at = NOW(),
            instructor_locked = true,
            selected_draft_id = NULL,
            updated_at = NOW()
        WHERE id = ${requestId}
      `
    }

    await logRecommendationAudit({
      requestId,
      actorType: "student",
      actorId: dbId,
      action: "manual_letter_submitted",
      details: { needReview, chars: letterText.length },
    })

    try {
      await notifyRecommendationStudent(
        requestId,
        needReview ? "letter_queued_for_review" : "finalized",
      )
    } catch (e) {
      console.error("[recommendations submit-letter] student milestone email:", e)
    }
    try {
      await notifyRecommendationInstructor(
        requestId,
        needReview ? "letter_submitted_for_review" : "letter_auto_finalized",
      )
    } catch (e) {
      console.error("[recommendations submit-letter] instructor milestone email:", e)
    }

    return NextResponse.json({ ok: true, status: needReview ? "student_selected" : "finalized" })
  } catch (e) {
    console.error("[recommendations submit-letter]", e)
    return NextResponse.json({ error: "Failed to submit letter" }, { status: 500 })
  }
}
