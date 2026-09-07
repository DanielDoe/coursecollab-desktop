import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import {
  canGenerateAiDrafts,
  ensureInstructorRecommendationSettings,
  getStudentTierForRec,
  logRecommendationAudit,
  type RecommendationSettingsRow,
} from "@/lib/recommendation-letters"
import { generateThreeRecommendationDrafts } from "@/lib/recommendation-letters-ai"
import type { RecommendationPurpose } from "@/lib/recommendation-letters"
import { notifyRecommendationInstructor } from "@/lib/recommendation-instructor-email"

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
    const bound = await requireBoundStudentCaller(request, raw || null)
    if (!bound.ok) return bound.response
    const dbId = bound.studentDbId

    const guestRows = await sql`
      SELECT is_platform_guest FROM students WHERE id = ${dbId} LIMIT 1
    `
    if (guestRows.length > 0 && Boolean((guestRows[0] as { is_platform_guest: boolean }).is_platform_guest)) {
      return NextResponse.json(
        {
          error:
            "Career Member accounts prepare a recommendation brief for faculty. Your instructor drafts the letter using Faculty Cora.",
        },
        { status: 403 },
      )
    }

    const rows = sqlRows<Record<string, unknown>>(
      await sql`
      SELECT r.*, sess.code AS course_code, sess.description AS course_description,
        i.name AS instructor_name, s.full_name AS student_full_name
      FROM recommendation_requests r
      JOIN sessions sess ON sess.id = r.course_id
      JOIN instructors i ON i.id = r.instructor_id
      JOIN students s ON s.id = r.student_id
      WHERE r.id = ${requestId} AND r.student_id = ${dbId}
      LIMIT 1
    `,
    )
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const reqRow = rows[0] as Record<string, unknown>

    const rst = String(reqRow.status)
    if (rst !== "approved" && rst !== "revision_requested") {
      return NextResponse.json({ error: "Request is not ready for draft generation" }, { status: 400 })
    }

    const prof = sqlRows<Record<string, unknown>>(
      await sql`SELECT * FROM recommendation_profiles WHERE request_id = ${requestId} LIMIT 1`,
    )
    if (prof.length === 0) {
      return NextResponse.json({ error: "Complete your profile first" }, { status: 400 })
    }

    await ensureInstructorRecommendationSettings(Number(reqRow.instructor_id))
    const settingsRows = sqlRows(
      await sql`
      SELECT * FROM recommendation_settings WHERE instructor_id = ${Number(reqRow.instructor_id)} LIMIT 1
    `,
    )
    const settings = settingsRows[0] as RecommendationSettingsRow | undefined
    if (!settings?.allow_ai_generation) {
      return NextResponse.json({ error: "AI drafts are disabled for this instructor" }, { status: 403 })
    }

    const tier = await getStudentTierForRec(dbId)
    const batchCount = Number(reqRow.ai_batch_count ?? 0)
    const gate = await canGenerateAiDrafts({
      studentId: dbId,
      tier,
      settings,
      currentBatchCount: batchCount,
    })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.reason ?? "Cannot generate" }, { status: 403 })
    }

    await sql`DELETE FROM recommendation_drafts WHERE request_id = ${requestId}`

    const profile = prof[0] as Record<string, unknown>
    const generated = await generateThreeRecommendationDrafts({
      studentName: String(reqRow.student_full_name ?? "Student"),
      purpose: String(reqRow.purpose) as RecommendationPurpose,
      recipientName: reqRow.recipient_name ? String(reqRow.recipient_name) : null,
      recipientOrg: reqRow.recipient_organization ? String(reqRow.recipient_organization) : null,
      recipientAddress: typeof reqRow.recipient_address === "string" ? reqRow.recipient_address : null,
      letterIsSpecific: Boolean(reqRow.letter_is_specific),
      courseLabel: `${reqRow.course_code ?? ""} ${reqRow.course_description ?? ""}`.trim(),
      instructorDisplayName: String(reqRow.instructor_name ?? "Instructor"),
      defaultTone: String(settings.default_tone ?? "professional"),
      profile: {
        content_mode: profile.content_mode as string | null,
        student_strengths: profile.student_strengths as string | null,
        achievements: profile.achievements as string | null,
        projects: profile.projects as string | null,
        skills: profile.skills as string | null,
        leadership_examples: profile.leadership_examples as string | null,
        goals: profile.goals as string | null,
        tone: profile.tone as string | null,
        special_instructions: profile.special_instructions as string | null,
        letter_for: profile.letter_for as string | null,
        class_experience: profile.class_experience as string | null,
        personal_qualities: profile.personal_qualities as string | null,
      },
      instructorExtra: settings.extra_instructions,
    })

    await sql`
      INSERT INTO recommendation_drafts (request_id, version_label, letter_text, selected, ai_model)
      VALUES
        (${requestId}, 'Professional / Formal', ${generated.formal}, false, ${generated.modelUsed}),
        (${requestId}, 'Warm / Supportive', ${generated.warm}, false, ${generated.modelUsed}),
        (${requestId}, 'Strong / Achievement-Focused', ${generated.achievement}, false, ${generated.modelUsed})
    `

    await sql`
      UPDATE recommendation_requests
      SET status = 'ai_generated',
          ai_batch_count = COALESCE(ai_batch_count, 0) + 1,
          updated_at = NOW()
      WHERE id = ${requestId}
    `

    await logRecommendationAudit({
      requestId,
      actorType: "student",
      actorId: dbId,
      action: "ai_drafts_generated",
      details: { batch: batchCount + 1, model: generated.modelUsed },
    })

    try {
      await notifyRecommendationInstructor(requestId, "ai_drafts_generated")
    } catch (e) {
      console.error("[recommendations generate] instructor email:", e)
    }

    const drafts = sqlRows(
      await sql`
      SELECT id, version_label, letter_text, selected, ai_model, created_at
      FROM recommendation_drafts WHERE request_id = ${requestId} ORDER BY id ASC
    `,
    )

    return NextResponse.json({ drafts })
  } catch (e) {
    console.error("[recommendations generate]", e)
    const msg = e instanceof Error ? e.message : "Generation failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
