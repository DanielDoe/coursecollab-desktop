import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import {
  ensureInstructorRecommendationSettings,
  logRecommendationAudit,
  type RecommendationSettingsRow,
} from "@/lib/recommendation-letters"
import { getRecommendationBrief } from "@/lib/recommendation-brief-store"
import { notifyRecommendationInstructor } from "@/lib/recommendation-instructor-email"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

async function loadFullRequest(requestId: number, studentId: number) {
  const rows = sqlRows(
    await sql`
    SELECT r.*,
      sess.code AS course_code,
      sess.description AS course_description,
      i.name AS instructor_name,
      s.full_name AS student_full_name
    FROM recommendation_requests r
    JOIN sessions sess ON sess.id = r.course_id
    JOIN instructors i ON i.id = r.instructor_id
    JOIN students s ON s.id = r.student_id
    WHERE r.id = ${requestId} AND r.student_id = ${studentId}
    LIMIT 1
  `,
  )
  return rows[0] ?? null
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)
    const { searchParams } = new URL(_request.url)
    const raw = (searchParams.get("studentDatabaseId") ?? searchParams.get("studentId") ?? "").trim()
    const bound = await requireBoundStudentCaller(_request, raw || null)
    if (!bound.ok) return bound.response
    const dbId = bound.studentDbId

    const reqRow = await loadFullRequest(requestId, dbId)
    if (!reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await ensureInstructorRecommendationSettings(Number(reqRow.instructor_id))
    const settingsRows = sqlRows(
      await sql`
      SELECT * FROM recommendation_settings WHERE instructor_id = ${Number(reqRow.instructor_id)} LIMIT 1
    `,
    )
    const settings = settingsRows[0] as RecommendationSettingsRow | undefined

    const profileRows = sqlRows(
      await sql`SELECT * FROM recommendation_profiles WHERE request_id = ${requestId}`,
    )
    const profile = profileRows[0] ?? null

    const drafts = sqlRows(
      await sql`
      SELECT id, version_label, letter_text, selected, ai_model, created_at
      FROM recommendation_drafts WHERE request_id = ${requestId}
      ORDER BY id ASC
    `,
    )

    const files = sqlRows(
      await sql`
      SELECT id, pdf_url, finalized_at, downloaded_at, created_at
      FROM recommendation_files WHERE request_id = ${requestId}
      ORDER BY id DESC LIMIT 5
    `,
    )

    const attachments = sqlRows(
      await sql`
      SELECT id, file_type, file_name, file_url, created_at
      FROM recommendation_attachments WHERE request_id = ${requestId}
      ORDER BY id ASC
    `,
    )

    const brief = await getRecommendationBrief(requestId)

    return NextResponse.json(
      { request: reqRow, settings, profile, drafts, files, attachments, brief },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    )
  } catch (e) {
    console.error("[recommendations get]", e)
    return NextResponse.json({ error: "Failed to load" }, { status: 500 })
  }
}

export async function PATCH(
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

    const reqRow = await loadFullRequest(requestId, dbId)
    if (!reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const status = String(reqRow.status)
    if (status !== "approved" && status !== "info_requested") {
      return NextResponse.json({ error: "Request is not waiting for your questionnaire" }, { status: 400 })
    }

    await ensureInstructorRecommendationSettings(Number(reqRow.instructor_id))
    const settingsRows = sqlRows(
      await sql`
      SELECT * FROM recommendation_settings WHERE instructor_id = ${Number(reqRow.instructor_id)} LIMIT 1
    `,
    )
    const settings = settingsRows[0] as RecommendationSettingsRow | undefined
    if (!settings) return NextResponse.json({ error: "Settings missing" }, { status: 500 })

    const contentSource = String(body.contentSource ?? body.content_source ?? "")
    if (contentSource !== "own_details" && contentSource !== "ai_guided") {
      return NextResponse.json({ error: "contentSource required" }, { status: 400 })
    }

    const extras: Record<string, unknown> =
      typeof body.extras === "object" && body.extras !== null ? body.extras : {}

    await sql`
      INSERT INTO recommendation_profiles (
        request_id, content_mode, student_strengths, achievements, projects, skills,
        leadership_examples, goals, tone, special_instructions,
        letter_for, class_experience, personal_qualities, extras
      ) VALUES (
        ${requestId}, ${contentSource},
        ${body.studentStrengths ?? body.student_strengths ?? null},
        ${body.achievements ?? null},
        ${body.projects ?? null},
        ${body.skills ?? null},
        ${body.leadershipExamples ?? body.leadership_examples ?? null},
        ${body.goals ?? null},
        ${body.tone ?? null},
        ${body.specialInstructions ?? body.special_instructions ?? null},
        ${body.letterFor ?? body.letter_for ?? null},
        ${body.classExperience ?? body.class_experience ?? null},
        ${body.personalQualities ?? body.personal_qualities ?? null},
        ${JSON.stringify(extras)}::jsonb
      )
      ON CONFLICT (request_id) DO UPDATE SET
        content_mode = EXCLUDED.content_mode,
        student_strengths = EXCLUDED.student_strengths,
        achievements = EXCLUDED.achievements,
        projects = EXCLUDED.projects,
        skills = EXCLUDED.skills,
        leadership_examples = EXCLUDED.leadership_examples,
        goals = EXCLUDED.goals,
        tone = EXCLUDED.tone,
        special_instructions = EXCLUDED.special_instructions,
        letter_for = EXCLUDED.letter_for,
        class_experience = EXCLUDED.class_experience,
        personal_qualities = EXCLUDED.personal_qualities,
        extras = EXCLUDED.extras,
        updated_at = NOW()
    `

    const requireResume = Boolean(settings.require_resume)
    const requireTranscript = Boolean(settings.require_transcript)
    if (requireResume || requireTranscript) {
      const atts = sqlRows<{ file_type: string }>(
        await sql`
        SELECT file_type FROM recommendation_attachments WHERE request_id = ${requestId}
      `,
      )
      const types = new Set(atts.map((a) => a.file_type))
      if (requireResume && !types.has("resume")) {
        return NextResponse.json({ error: "Resume upload is required" }, { status: 400 })
      }
      if (requireTranscript && !types.has("transcript")) {
        return NextResponse.json({ error: "Transcript upload is required" }, { status: 400 })
      }
    }

    const allowAi = Boolean(settings.allow_ai_generation)
    /** Stay on approved so the student can compose their letter before involving the instructor again. */
    const nextStatus = "approved"

    await sql`
      UPDATE recommendation_requests
      SET content_source = ${contentSource},
          status = ${nextStatus},
          updated_at = NOW()
      WHERE id = ${requestId}
    `

    await logRecommendationAudit({
      requestId,
      actorType: "student",
      actorId: dbId,
      action: allowAi ? "profile_saved" : "profile_saved_ready_for_manual_letter",
      details: { contentSource },
    })

    try {
      await notifyRecommendationInstructor(requestId, "questionnaire_submitted", {
        repliedToInfoRequest: status === "info_requested",
      })
    } catch (emailErr) {
      console.error("[recommendations patch] instructor milestone email:", emailErr)
    }

    return NextResponse.json({ ok: true, status: nextStatus })
  } catch (e) {
    console.error("[recommendations patch]", e)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)
    const { searchParams } = new URL(request.url)
    const raw = String(searchParams.get("studentDatabaseId") ?? searchParams.get("studentId") ?? "").trim()
    const bound = await requireBoundStudentCaller(request, raw || null)
    if (!bound.ok) return bound.response
    const dbId = bound.studentDbId

    const reqRow = await loadFullRequest(requestId, dbId)
    if (!reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const st = String((reqRow as { status?: string }).status ?? "")
    const draftCountRows = sqlRows<{ c: string }>(
      await sql`
      SELECT COUNT(*)::text AS c FROM recommendation_drafts WHERE request_id = ${requestId}
    `,
    )
    const draftCount = parseInt(String(draftCountRows[0]?.c ?? "0"), 10) || 0

    const canWithdraw =
      st === "requested" || st === "info_requested" || (st === "approved" && draftCount === 0)

    if (!canWithdraw) {
      return NextResponse.json(
        {
          error:
            "This request can't be withdrawn anymore. Contact your instructor if you need to cancel.",
        },
        { status: 400 },
      )
    }

    await logRecommendationAudit({
      requestId,
      actorType: "student",
      actorId: dbId,
      action: "withdrawn",
      details: { previousStatus: st },
    })

    try {
      await notifyRecommendationInstructor(requestId, "student_withdrew", { previousStatus: st })
    } catch (emailErr) {
      console.error("[recommendations delete] instructor milestone email:", emailErr)
    }

    await sql`DELETE FROM recommendation_requests WHERE id = ${requestId} AND student_id = ${dbId}`

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[recommendations delete]", e)
    return NextResponse.json({ error: "Failed to withdraw" }, { status: 500 })
  }
}
