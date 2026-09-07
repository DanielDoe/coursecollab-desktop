import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import {
  ensureInstructorRecommendationSettings,
  logRecommendationAudit,
  type RecommendationSettingsRow,
} from "@/lib/recommendation-letters"
import { mergeRecommendationRequestDetailsFromBody } from "@/lib/recommendation-merge-request-details"
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import {
  instructorCanEditRequestMetadata,
  recommendationStudentRequestPath,
  requestDetailsFieldsChanged,
} from "@/lib/recommendation-request-transitions"

export const dynamic = "force-dynamic"

/** Students must not edit closed requests; instructors may still fix metadata after release. */

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response
    const inst = session.instructorId
    const scoped = await resolveOptionalCourseScope(request)
    if (!scoped.ok) return scoped.response
    if (scoped.courseId != null && String(scoped.instructorId ?? "") !== String(inst)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    const prevRows = sqlRows<{
      status: string
      student_id: number
      is_platform_guest: boolean
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
        SELECT r.status, r.student_id, COALESCE(s.is_platform_guest, false) AS is_platform_guest, r.purpose, r.letter_is_specific, r.instructor_id,
          r.purpose_other_detail, r.recipient_name, r.recipient_organization, r.recipient_address,
          r.student_request_description, r.deadline
        FROM recommendation_requests r
        JOIN students s ON s.id = r.student_id
        WHERE r.id = ${requestId} AND r.instructor_id = ${inst}
        LIMIT 1
      `,
    )
    const prev = prevRows[0]
    if (!prev) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (!instructorCanEditRequestMetadata(String(prev.status))) {
      return NextResponse.json({ error: "This request cannot be edited in its current status." }, { status: 400 })
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
      WHERE id = ${requestId} AND instructor_id = ${inst}
    `

    await logRecommendationAudit({
      requestId,
      actorType: "instructor",
      actorId: inst,
      action: "instructor_request_details_updated",
      details: { purpose: mergedPurpose },
    })

    const studentRecLink = recommendationStudentRequestPath(requestId, Boolean(prev.is_platform_guest))
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
        await sql`
          INSERT INTO notifications (student_id, type, title, message, link, is_read, created_at)
          VALUES (
            ${prev.student_id},
            'recommendation_instructor_update',
            ${`Recommendation #${requestId} · details updated`},
            ${`Your instructor updated purpose, deadline, recipient, or notes on this request.`},
            ${studentRecLink},
            false,
            NOW()
          )
        `
      } catch {
        /* notifications table may be missing */
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

    return NextResponse.json({ ok: true, request: out[0] ?? null })
  } catch (e) {
    console.error("[instructor request-details]", e)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
