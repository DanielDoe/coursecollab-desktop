import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import {
  canUseAiPolish,
  ensureInstructorRecommendationSettings,
  getStudentTierForRec,
  logRecommendationAudit,
  type RecommendationSettingsRow,
} from "@/lib/recommendation-letters"
import { polishLetterText } from "@/lib/recommendation-letters-ai"

export const dynamic = "force-dynamic"

const MAX_POLISH = 3

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)
    const body = await request.json()
    const raw = String(body.studentDatabaseId ?? body.studentId ?? "").trim()
    const instruction = String(body.instruction ?? "").trim()
    const bound = await requireBoundStudentCaller(request, raw || null)
    if (!bound.ok) return bound.response
    const dbId = bound.studentDbId
    if (!instruction) return NextResponse.json({ error: "instruction required" }, { status: 400 })

    const rows = sqlRows(
      await sql`
      SELECT r.* FROM recommendation_requests r
      WHERE r.id = ${requestId} AND r.student_id = ${dbId}
      LIMIT 1
    `,
    )
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const reqRow = rows[0] as { status: string; instructor_id: number; polish_count: number | null; final_letter_text: string | null }

    const st = String(reqRow.status)
    if (
      st !== "ai_generated" &&
      st !== "student_selected" &&
      st !== "instructor_review_pending" &&
      st !== "revision_requested" &&
      st !== "finalized"
    ) {
      return NextResponse.json({ error: "Letter is not editable at this stage" }, { status: 400 })
    }

    await ensureInstructorRecommendationSettings(Number(reqRow.instructor_id))
    const settingsRows = sqlRows(
      await sql`
      SELECT * FROM recommendation_settings WHERE instructor_id = ${Number(reqRow.instructor_id)} LIMIT 1
    `,
    )
    const settings = settingsRows[0] as RecommendationSettingsRow | undefined
    if (!settings) return NextResponse.json({ error: "Settings missing" }, { status: 500 })

    const tier = await getStudentTierForRec(dbId)
    if (!canUseAiPolish(tier, settings)) {
      return NextResponse.json({ error: "AI polish is available on the Trailblazer plan when your instructor allows it." }, { status: 403 })
    }

    const polishCount = Number(reqRow.polish_count ?? 0)
    if (polishCount >= MAX_POLISH) {
      return NextResponse.json({ error: "Maximum polish requests reached for this letter" }, { status: 403 })
    }

    const draftRows = sqlRows<{ letter_text: string }>(
      await sql`
      SELECT letter_text FROM recommendation_drafts
      WHERE request_id = ${requestId} AND selected = true LIMIT 1
    `,
    )
    const baseText =
      draftRows.length > 0
        ? String(draftRows[0].letter_text)
        : String(reqRow.final_letter_text ?? "")
    if (!baseText.trim()) {
      return NextResponse.json({ error: "No letter text to polish" }, { status: 400 })
    }

    const polished = await polishLetterText({ letterText: baseText, instruction })

    await sql`
      UPDATE recommendation_drafts
      SET letter_text = ${polished.text}
      WHERE request_id = ${requestId} AND selected = true
    `
    await sql`
      UPDATE recommendation_requests
      SET final_letter_text = ${polished.text},
          polish_count = COALESCE(polish_count, 0) + 1,
          updated_at = NOW()
      WHERE id = ${requestId}
    `

    await logRecommendationAudit({
      requestId,
      actorType: "student",
      actorId: dbId,
      action: "ai_polish",
      details: { count: polishCount + 1, model: polished.modelUsed },
    })

    return NextResponse.json({ letterText: polished.text, polishCount: polishCount + 1 })
  } catch (e) {
    console.error("[recommendations polish]", e)
    const msg = e instanceof Error ? e.message : "Polish failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
