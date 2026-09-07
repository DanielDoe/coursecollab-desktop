import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { logRecommendationAudit } from "@/lib/recommendation-letters"
import { RECOMMENDATION_PURPOSES, type RecommendationPurpose } from "@/lib/recommendation-letters-shared"

export const dynamic = "force-dynamic"

function optTrim(v: unknown, max = 500): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s.slice(0, max) : null
}

function parsePurpose(raw: unknown): RecommendationPurpose | null {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : ""
  return (RECOMMENDATION_PURPOSES as readonly string[]).includes(s) ? (s as RecommendationPurpose) : null
}

/**
 * PATCH: update recipient lines and purpose shown in the formal letter preview (salutation + "Re:" line).
 * Allowed while status is `approved` (student is drafting before submit Letter).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)
    const body = await request.json().catch(() => ({}))

    const raw = String(body.studentDatabaseId ?? body.studentId ?? "").trim()
    const bound = await requireBoundStudentCaller(request, raw || null)
    if (!bound.ok) return bound.response
    const dbId = bound.studentDbId

    const rows = sqlRows<{ status: string; student_id: number }>(
      await sql`
        SELECT status, student_id FROM recommendation_requests
        WHERE id = ${requestId} AND student_id = ${dbId}
        LIMIT 1
      `,
    )
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const sms = String(rows[0].status)
    if (sms !== "approved" && sms !== "revision_requested") {
      return NextResponse.json(
        {
          error:
            "You can update these fields while drafting your letter or when your instructor has asked you to revise.",
        },
        { status: 400 },
      )
    }

    const prof = sqlRows(await sql`SELECT 1 FROM recommendation_profiles WHERE request_id = ${requestId} LIMIT 1`)
    if (prof.length === 0) {
      return NextResponse.json({ error: "Complete your questionnaire first" }, { status: 400 })
    }

    const curRows = sqlRows<{ purpose: string; letter_is_specific: boolean; recipient_address: string | null }>(
      await sql`
        SELECT purpose, letter_is_specific, recipient_address FROM recommendation_requests
        WHERE id = ${requestId} AND student_id = ${dbId}
        LIMIT 1
      `,
    )

    const recipientNameIn = optTrim(body.recipientName ?? body.recipient_name)
    const recipientOrgIn = optTrim(body.recipientOrganization ?? body.recipient_organization)
    const recipientAddrIn =
      Object.prototype.hasOwnProperty.call(body, "recipientAddress") ||
      Object.prototype.hasOwnProperty.call(body, "recipient_address")
        ? optTrim(body.recipientAddress ?? body.recipient_address, 2000)
        : curRows[0]?.recipient_address ?? null
    const storedPurposeRaw = curRows[0]?.purpose ?? "other"

    let purposeResolved: RecommendationPurpose
    if (body.purpose !== undefined && body.purpose !== null && body.purpose !== "") {
      const p = parsePurpose(body.purpose)
      if (!p) return NextResponse.json({ error: "Invalid letter purpose" }, { status: 400 })
      purposeResolved = p
    } else {
      const p = parsePurpose(storedPurposeRaw)
      purposeResolved = p ?? "other"
    }

    let letterIsSpecific: boolean
    if (typeof body.letterIsSpecific === "boolean") {
      letterIsSpecific = body.letterIsSpecific
    } else if (typeof body.letter_is_specific === "boolean") {
      letterIsSpecific = body.letter_is_specific
    } else {
      letterIsSpecific =
        (recipientNameIn?.length ?? 0) > 0 ||
        (recipientOrgIn?.length ?? 0) > 0 ||
        (recipientAddrIn != null && String(recipientAddrIn).trim().length > 0) ||
        Boolean(curRows[0]?.letter_is_specific)
    }

    const storedAddr =
      letterIsSpecific && recipientAddrIn?.trim() ? recipientAddrIn.trim().slice(0, 2000) : null

    await sql`
      UPDATE recommendation_requests
      SET
        recipient_name = ${recipientNameIn},
        recipient_organization = ${recipientOrgIn},
        recipient_address = ${storedAddr},
        purpose = ${purposeResolved},
        letter_is_specific = ${letterIsSpecific},
        updated_at = NOW()
      WHERE id = ${requestId} AND student_id = ${dbId}
    `

    await logRecommendationAudit({
      requestId,
      actorType: "student",
      actorId: dbId,
      action: "letter_metadata_updated",
      details: {
        recipientNamePresent: Boolean(recipientNameIn),
        recipientOrgPresent: Boolean(recipientOrgIn),
        purpose: purposeResolved,
        letterIsSpecific,
      },
    })

    const out = sqlRows(
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
        WHERE r.id = ${requestId}
        LIMIT 1
      `,
    )

    return NextResponse.json(
      { ok: true, request: out[0] ?? null },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    )
  } catch (e) {
    console.error("[letter-metadata patch]", e)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
