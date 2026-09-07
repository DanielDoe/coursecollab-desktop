import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { ensureInstructorRecommendationSettings, logRecommendationAudit } from "@/lib/recommendation-letters"
import { notifyRecommendationInstructor } from "@/lib/recommendation-instructor-email"

export const dynamic = "force-dynamic"

const VALID_MODES = new Set(["bring_own_draft", "questionnaire_ai"])

async function respondWithFullBundle(requestId: number, dbId: number, instructorId: number) {
  const full = sqlRows(
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
      WHERE r.id = ${requestId} AND r.student_id = ${dbId}
      LIMIT 1
    `,
  )

  const settingsRows = sqlRows(
    await sql`SELECT * FROM recommendation_settings WHERE instructor_id = ${Number(instructorId)} LIMIT 1`,
  )

  const profileRows = sqlRows(
    await sql`SELECT * FROM recommendation_profiles WHERE request_id = ${requestId}`,
  )
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

  return NextResponse.json({
    request: full[0],
    settings: settingsRows[0],
    profile: profileRows[0] ?? null,
    drafts,
    files,
    attachments,
  })
}

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

    /** Return to the two-card choice (before questionnaire or before template workspace). */
    if (String(body.action ?? "").trim() === "reset") {
      const reqRows = sqlRows<{
        status: string
        letter_intake_mode: string | null
        student_id: number
      }>(
        await sql`
        SELECT status, letter_intake_mode, student_id FROM recommendation_requests
        WHERE id = ${requestId} AND student_id = ${dbId} LIMIT 1
      `,
      )
      const row = reqRows[0]
      if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

      const st = String(row.status ?? "")
      if (st !== "approved" && st !== "info_requested") {
        return NextResponse.json({ error: "Request is not open for this step" }, { status: 400 })
      }

      const mode = String(row.letter_intake_mode ?? "").trim()
      if (!mode) {
        return NextResponse.json({ error: "Nothing to reset" }, { status: 400 })
      }

      const draftCountRows = sqlRows<{ c: string }>(
        await sql`SELECT COUNT(*)::text AS c FROM recommendation_drafts WHERE request_id = ${requestId}`,
      )
      const draftCount = parseInt(String(draftCountRows[0]?.c ?? "0"), 10) || 0
      if (draftCount > 0) {
        return NextResponse.json(
          { error: "Cannot change your path after drafts have been generated." },
          { status: 400 },
        )
      }

      if (mode === "questionnaire_ai") {
        const profileCountRows = sqlRows<{ c: string }>(
          await sql`SELECT COUNT(*)::text AS c FROM recommendation_profiles WHERE request_id = ${requestId}`,
        )
        const profCount = parseInt(String(profileCountRows[0]?.c ?? "0"), 10) || 0
        if (profCount > 0) {
          return NextResponse.json(
            { error: "Your answers are already saved. Contact your instructor if you need to start over." },
            { status: 400 },
          )
        }
        await sql`
          UPDATE recommendation_requests
          SET letter_intake_mode = NULL, updated_at = NOW()
          WHERE id = ${requestId} AND student_id = ${dbId}
        `
      } else if (mode === "bring_own_draft") {
        const stubRows = sqlRows<{ extras: unknown }>(
          await sql`SELECT extras FROM recommendation_profiles WHERE request_id = ${requestId} LIMIT 1`,
        )
        const extras = stubRows[0]?.extras
        const isStub =
          extras &&
          typeof extras === "object" &&
          extras !== null &&
          (extras as { intakeBringOwnDraft?: boolean }).intakeBringOwnDraft === true
        if (!isStub) {
          return NextResponse.json({ error: "Cannot reset this path anymore." }, { status: 400 })
        }
        await sql`DELETE FROM recommendation_profiles WHERE request_id = ${requestId}`
        await sql`
          UPDATE recommendation_requests
          SET letter_intake_mode = NULL, updated_at = NOW()
          WHERE id = ${requestId} AND student_id = ${dbId}
        `
      } else {
        return NextResponse.json({ error: "Unknown intake mode" }, { status: 400 })
      }

      await logRecommendationAudit({
        requestId,
        actorType: "student",
        actorId: dbId,
        action: "letter_intake_reset",
        details: { previousMode: mode },
      })

      const instRows = sqlRows<{ instructor_id: number }>(
        await sql`SELECT instructor_id FROM recommendation_requests WHERE id = ${requestId} LIMIT 1`,
      )
      const instructorId = instRows[0]?.instructor_id
      if (instructorId == null) return NextResponse.json({ error: "Missing instructor" }, { status: 500 })

      await ensureInstructorRecommendationSettings(Number(instructorId))

      return await respondWithFullBundle(requestId, dbId, instructorId)
    }

    const mode = String(body.mode ?? "").trim()
    if (!VALID_MODES.has(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
    }

    const rows = sqlRows<{ status: string; letter_intake_mode: string | null }>(
      await sql`
      SELECT status, letter_intake_mode FROM recommendation_requests
      WHERE id = ${requestId} AND student_id = ${dbId} LIMIT 1
    `,
    )
    const row = rows[0]
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const st = String(row.status ?? "")
    if (st !== "approved" && st !== "info_requested") {
      return NextResponse.json({ error: "Request is not open for this step" }, { status: 400 })
    }

    const profileExistsRows = sqlRows<{ c: string }>(
      await sql`
      SELECT COUNT(*)::text AS c FROM recommendation_profiles WHERE request_id = ${requestId}
    `,
    )
    const hasProfile = parseInt(String(profileExistsRows[0]?.c ?? "0"), 10) > 0
    if (hasProfile) {
      return NextResponse.json({ error: "Questionnaire already started" }, { status: 400 })
    }

    if (row.letter_intake_mode != null && String(row.letter_intake_mode).trim() !== "") {
      return NextResponse.json({ error: "Intake choice already recorded" }, { status: 400 })
    }

    const instRows = sqlRows<{ instructor_id: number }>(
      await sql`SELECT instructor_id FROM recommendation_requests WHERE id = ${requestId} LIMIT 1`,
    )
    const instructorId = instRows[0]?.instructor_id
    if (instructorId == null) return NextResponse.json({ error: "Missing instructor" }, { status: 500 })

    await ensureInstructorRecommendationSettings(Number(instructorId))

    await sql`
      UPDATE recommendation_requests
      SET letter_intake_mode = ${mode}, updated_at = NOW()
      WHERE id = ${requestId} AND student_id = ${dbId}
    `

    if (mode === "bring_own_draft") {
      await sql`
        INSERT INTO recommendation_profiles (
          request_id, content_mode, student_strengths, achievements, projects, skills,
          leadership_examples, goals, tone, special_instructions,
          letter_for, class_experience, personal_qualities, extras
        ) VALUES (
          ${requestId},
          'own_details',
          '',
          '',
          '',
          '',
          '',
          '',
          'professional',
          'Started from instructor template — replace bracketed placeholders with your draft.',
          '',
          '',
          '',
          '{"intakeBringOwnDraft":true}'::jsonb
        )
        ON CONFLICT (request_id) DO UPDATE SET
          content_mode = EXCLUDED.content_mode,
          updated_at = NOW()
      `
    }

    await logRecommendationAudit({
      requestId,
      actorType: "student",
      actorId: dbId,
      action: "letter_intake_selected",
      details: { mode },
    })

    try {
      await notifyRecommendationInstructor(requestId, "intake_lane_selected", { intakeMode: mode })
    } catch (e) {
      console.error("[recommendations intake] instructor email:", e)
    }

    return await respondWithFullBundle(requestId, dbId, instructorId)
  } catch (e) {
    console.error("[recommendations intake]", e)
    return NextResponse.json({ error: "Failed to save intake" }, { status: 500 })
  }
}
