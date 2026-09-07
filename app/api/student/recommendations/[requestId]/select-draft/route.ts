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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)
    const body = await request.json()
    const raw = String(body.studentDatabaseId ?? body.studentId ?? "").trim()
    const draftId = Number(body.draftId ?? body.draft_id)
    const bound = await requireBoundStudentCaller(request, raw || null)
    if (!bound.ok) return bound.response
    const dbId = bound.studentDbId
    if (!Number.isFinite(draftId)) return NextResponse.json({ error: "draft id required" }, { status: 400 })

    const rows = sqlRows(
      await sql`
      SELECT r.* FROM recommendation_requests r
      WHERE r.id = ${requestId} AND r.student_id = ${dbId}
      LIMIT 1
    `,
    )
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const reqRow = rows[0] as { status: string; instructor_id: number }

    if (String(reqRow.status) !== "ai_generated") {
      return NextResponse.json({ error: "No drafts to select from" }, { status: 400 })
    }

    const drows = sqlRows(
      await sql`
      SELECT letter_text FROM recommendation_drafts
      WHERE id = ${draftId} AND request_id = ${requestId} LIMIT 1
    `,
    )
    if (drows.length === 0) return NextResponse.json({ error: "Draft not found" }, { status: 404 })
    const letterText = String(drows[0].letter_text ?? "")

    await ensureInstructorRecommendationSettings(Number(reqRow.instructor_id))
    const settingsRows = sqlRows(
      await sql`
      SELECT * FROM recommendation_settings WHERE instructor_id = ${Number(reqRow.instructor_id)} LIMIT 1
    `,
    )
    const settings = settingsRows[0] as RecommendationSettingsRow | undefined
    if (!settings) return NextResponse.json({ error: "Settings missing" }, { status: 500 })

    const needReview = Boolean(settings.require_final_review)

    await sql`UPDATE recommendation_drafts SET selected = false WHERE request_id = ${requestId}`
    await sql`UPDATE recommendation_drafts SET selected = true WHERE id = ${draftId}`

    if (needReview) {
      await sql`
        UPDATE recommendation_requests
        SET selected_draft_id = ${draftId},
            final_letter_text = ${letterText},
            status = 'student_selected',
            updated_at = NOW()
        WHERE id = ${requestId}
      `
    } else {
      await sql`
        UPDATE recommendation_requests
        SET selected_draft_id = ${draftId},
            final_letter_text = ${letterText},
            status = 'finalized',
            instructor_reviewed_at = NOW(),
            instructor_locked = true,
            updated_at = NOW()
        WHERE id = ${requestId}
      `
    }

    await logRecommendationAudit({
      requestId,
      actorType: "student",
      actorId: dbId,
      action: "draft_selected",
      details: { draftId, needReview },
    })

    try {
      await notifyRecommendationStudent(
        requestId,
        needReview ? "letter_queued_for_review" : "finalized",
      )
    } catch (e) {
      console.error("[recommendations select-draft] student milestone email:", e)
    }
    try {
      await notifyRecommendationInstructor(
        requestId,
        needReview ? "letter_submitted_for_review" : "letter_auto_finalized",
      )
    } catch (e) {
      console.error("[recommendations select-draft] instructor milestone email:", e)
    }

    return NextResponse.json({ ok: true, status: needReview ? "student_selected" : "finalized" })
  } catch (e) {
    console.error("[recommendations select]", e)
    return NextResponse.json({ error: "Failed to select draft" }, { status: 500 })
  }
}
