import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import {
  ensureInstructorRecommendationSettings,
  logRecommendationAudit,
  type RecommendationSettingsRow,
} from "@/lib/recommendation-letters"
import { mergeRecommendationRequestDetailsFromBody } from "@/lib/recommendation-merge-request-details"
import { notifyRecommendationInstructor } from "@/lib/recommendation-instructor-email"
import { requestDetailsFieldsChanged } from "@/lib/recommendation-request-transitions"
import { createInstructorNotification } from "@/lib/create-instructor-notification"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    const raw = String(body.studentDatabaseId ?? body.studentId ?? "").trim()
    const bound = await requireBoundStudentCaller(request, raw || null)
    if (!bound.ok) return bound.response
    const dbId = bound.studentDbId

    const prevRows = sqlRows<{
      status: string
      purpose: string
      letter_is_specific: boolean
      instructor_id: number
      purpose_other_detail: string | null
      recipient_name: string | null
      recipient_organization: string | null
      recipient_address: string | null
      student_request_description: string | null
      deadline: string | null
    }>(
      await sql`
        SELECT status, purpose, letter_is_specific, instructor_id,
          purpose_other_detail, recipient_name, recipient_organization, recipient_address,
          student_request_description, deadline
        FROM recommendation_requests WHERE id = ${requestId} AND student_id = ${dbId}
        LIMIT 1
      `,
    )
    const prev = prevRows[0]
    if (!prev) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const status = String(prev.status ?? "")
    if (status === "rejected") {
      return NextResponse.json(
        { error: "This request can no longer be edited from the student side." },
        { status: 400 },
      )
    }

    await ensureInstructorRecommendationSettings(Number(prev.instructor_id))
    const settingsRows = sqlRows(
      await sql`SELECT * FROM recommendation_settings WHERE instructor_id = ${Number(prev.instructor_id)} LIMIT 1`,
    )
    const settings = settingsRows[0] as RecommendationSettingsRow | undefined
    if (!settings) return NextResponse.json({ error: "Settings missing" }, { status: 500 })

    const mergedResult = mergeRecommendationRequestDetailsFromBody(body, prev, settings)
    if (!mergedResult.ok) {
      return NextResponse.json({ error: mergedResult.error }, { status: 400 })
    }
    const {
      mergedPurpose,
      mergedOther,
      mergedRecipientName,
      mergedRecipientOrg,
      mergedLetterSpecific,
      mergedRecipientAddress,
      mergedStudentDesc,
      mergedDeadline,
    } = mergedResult.merged

    await sql`
      UPDATE recommendation_requests
      SET
        recipient_name = ${mergedRecipientName},
        recipient_organization = ${mergedRecipientOrg},
        recipient_address = ${mergedRecipientAddress},
        purpose = ${mergedPurpose},
        purpose_other_detail = ${mergedPurpose === "other" ? mergedOther : null},
        letter_is_specific = ${mergedLetterSpecific},
        student_request_description = ${mergedStudentDesc},
        deadline = ${mergedDeadline},
        updated_at = NOW()
      WHERE id = ${requestId} AND student_id = ${dbId}
    `

    await logRecommendationAudit({
      requestId,
      actorType: "student",
      actorId: dbId,
      action: "student_request_details_updated",
      details: { purpose: mergedPurpose },
    })

    const studentNameRow = sqlRows<{ full_name: string | null }>(
      await sql`SELECT full_name FROM students WHERE id = ${dbId} LIMIT 1`,
    )
    const studentName = studentNameRow[0]?.full_name?.trim() || "A student"

    const fieldsChanged = requestDetailsFieldsChanged(prev, {
      mergedPurpose,
      mergedOther,
      mergedRecipientName,
      mergedRecipientOrg,
      mergedRecipientAddress,
      mergedStudentDesc,
      mergedDeadline,
      mergedLetterSpecific,
    })

    if (fieldsChanged) {
      try {
        await createInstructorNotification({
          type: "recommendation_update",
          title: `Recommendation · request #${requestId} updated`,
          message: `${studentName} updated request details (recipient, purpose, deadline, or note). Their approval step is unchanged — open the request to review.`,
          link: `/instructor/dashboard-v2/recommendations/${requestId}`,
          source_type: "recommendation_request",
          source_id: String(requestId),
          instructorId: Number(prev.instructor_id) || null,
        })
      } catch {
        /* notifications table may be missing */
      }

      try {
        await notifyRecommendationInstructor(requestId, "request_details_updated")
      } catch (emailErr) {
        console.error("[request-details patch] instructor milestone email:", emailErr)
      }
    }

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
    console.error("[request-details patch]", e)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
