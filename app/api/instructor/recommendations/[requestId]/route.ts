import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { logRecommendationAudit } from "@/lib/recommendation-letters"
import { notifyRecommendationStudent } from "@/lib/recommendation-student-email"
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { getRecommendationBrief } from "@/lib/recommendation-brief-store"
import { normalizeDeliveryMethod } from "@/lib/recommendation-delivery"
import {
  instructorCanClassicFinalize,
  instructorCanDecideInitialRequest,
  instructorCanReleaseLetter,
  instructorCanRequestMoreInfo,
  recommendationStudentRequestPath,
  statusAfterInstructorSaveLetterText,
} from "@/lib/recommendation-request-transitions"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response
    const id = session.instructorId
    const scoped = await resolveOptionalCourseScope(request)
    if (!scoped.ok) return scoped.response
    if (scoped.courseId != null && String(scoped.instructorId ?? "") !== String(id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)

    const rows = sqlRows(
      await sql`
      SELECT r.*,
        s.full_name AS student_name,
        s.student_id AS student_external_id,
        s.email AS student_email,
        sess.code AS course_code,
        sess.description AS course_description
      FROM recommendation_requests r
      JOIN students s ON s.id = r.student_id
      JOIN sessions sess ON sess.id = r.course_id
      WHERE r.id = ${requestId} AND r.instructor_id = ${id}
      LIMIT 1
    `,
    )
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const profile = sqlRows(await sql`SELECT * FROM recommendation_profiles WHERE request_id = ${requestId} LIMIT 1`)
    const drafts = sqlRows(await sql`SELECT * FROM recommendation_drafts WHERE request_id = ${requestId} ORDER BY id`)
    const files = sqlRows(await sql`SELECT * FROM recommendation_files WHERE request_id = ${requestId} ORDER BY id DESC`)
    const attachments = sqlRows(await sql`SELECT * FROM recommendation_attachments WHERE request_id = ${requestId}`)
    const audit = sqlRows(
      await sql`
      SELECT * FROM recommendation_audit_log WHERE request_id = ${requestId} ORDER BY id DESC LIMIT 50
    `,
    )
    const settingsRows = sqlRows(
      await sql`SELECT * FROM recommendation_settings WHERE instructor_id = ${id} LIMIT 1`,
    )

    const briefRow = await getRecommendationBrief(requestId)

    return NextResponse.json({
      request: rows[0],
      settings: settingsRows[0] ?? null,
      profile: profile[0] ?? null,
      brief: briefRow,
      drafts,
      files,
      attachments,
      audit,
    })
  } catch (e) {
    console.error("[instructor rec detail]", e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response
    const id = session.instructorId
    const scoped = await resolveOptionalCourseScope(request)
    if (!scoped.ok) return scoped.response
    if (scoped.courseId != null && String(scoped.instructorId ?? "") !== String(id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)
    const body = await request.json()
    const action = String(body.action ?? "")
    let patchExtras: Record<string, unknown> | undefined

    const existing = sqlRows(
      await sql`
      SELECT r.* FROM recommendation_requests r
      WHERE r.id = ${requestId} AND r.instructor_id = ${id}
      LIMIT 1
    `,
    )
    if (existing.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const row = existing[0] as { status: string }

    if (action === "approve") {
      if (!instructorCanDecideInitialRequest(String(row.status))) {
        return NextResponse.json({ error: "Only pending requests can be approved" }, { status: 400 })
      }
      await sql`
        UPDATE recommendation_requests SET status = 'approved', updated_at = NOW() WHERE id = ${requestId}
      `
      await logRecommendationAudit({ requestId, actorType: "instructor", actorId: id, action: "approved", details: {} })
      try {
        const emailResult = await notifyRecommendationStudent(requestId, "approved")
        if (!emailResult.sent) {
          console.warn("[instructor rec patch] student approve email skipped:", emailResult.skipReason)
        }
      } catch (e) {
        console.error("[instructor rec patch] student email approve:", e)
      }
    } else if (action === "reject") {
      if (!instructorCanDecideInitialRequest(String(row.status))) {
        return NextResponse.json({ error: "Only pending requests can be rejected" }, { status: 400 })
      }
      const reason = String(body.reason ?? "")
      await sql`
        UPDATE recommendation_requests
        SET status = 'rejected', rejection_reason = ${reason}, updated_at = NOW()
        WHERE id = ${requestId}
      `
      await logRecommendationAudit({ requestId, actorType: "instructor", actorId: id, action: "rejected", details: { reason } })
      try {
        await notifyRecommendationStudent(requestId, "rejected", { reason })
      } catch (e) {
        console.error("[instructor rec patch] student email reject:", e)
      }
    } else if (action === "request_info") {
      const stIncoming = String(row.status)
      if (!instructorCanRequestMoreInfo(stIncoming)) {
        return NextResponse.json(
          {
            error:
              stIncoming === "student_selected" ||
              stIncoming === "instructor_review_pending" ||
              stIncoming === "revision_requested"
                ? 'Use “Request student revisions” instead — there is already a letter in review or a revision in progress.'
                : "More information cannot be requested in this status.",
          },
          { status: 400 },
        )
      }
      const note = String(body.note ?? "")
      await sql`
        UPDATE recommendation_requests
        SET status = 'info_requested', info_request_note = ${note}, updated_at = NOW()
        WHERE id = ${requestId}
      `
      await logRecommendationAudit({ requestId, actorType: "instructor", actorId: id, action: "info_requested", details: { note } })
      try {
        await notifyRecommendationStudent(requestId, "info_requested", { note })
      } catch (e) {
        console.error("[instructor rec patch] student email info_requested:", e)
      }
    } else if (action === "finalize") {
      const st = String(row.status)
      if (!instructorCanClassicFinalize(st)) {
        return NextResponse.json({ error: "Nothing to finalize" }, { status: 400 })
      }
      const currentRows = sqlRows(
        await sql`
        SELECT final_letter_text FROM recommendation_requests WHERE id = ${requestId} LIMIT 1
      `,
      )
      const currentText = String(currentRows[0]?.final_letter_text ?? "")
      const finalText =
        body.finalLetterText != null && String(body.finalLetterText).trim() !== ""
          ? String(body.finalLetterText)
          : currentText
      if (!finalText.trim()) {
        return NextResponse.json({ error: "Final letter text is empty" }, { status: 400 })
      }
      await sql`
        UPDATE recommendation_requests
        SET status = 'finalized',
            final_letter_text = ${finalText},
            instructor_locked = true,
            instructor_reviewed_at = NOW(),
            delivered_at = CASE
              WHEN delivery_method IN ('confidential', 'faculty_submits', 'designated_recipient') THEN NOW()
              ELSE delivered_at
            END,
            updated_at = NOW()
        WHERE id = ${requestId}
      `
      await logRecommendationAudit({ requestId, actorType: "instructor", actorId: id, action: "finalized", details: {} })
      try {
        await notifyRecommendationStudent(requestId, "finalized")
      } catch (e) {
        console.error("[instructor rec patch] student email finalized:", e)
      }
    } else if (action === "update_final_text") {
      const finalText = String(body.finalLetterText ?? "")
      const st = String(row.status)
      const nextStatus = statusAfterInstructorSaveLetterText(st, finalText.trim().length > 0)
      if (nextStatus && nextStatus !== st) {
        await sql`
          UPDATE recommendation_requests
          SET final_letter_text = ${finalText},
              status = ${nextStatus},
              updated_at = NOW()
          WHERE id = ${requestId}
        `
        await logRecommendationAudit({
          requestId,
          actorType: "instructor",
          actorId: id,
          action: "final_text_edited",
          details: { nextStatus },
        })
      } else {
        await sql`
          UPDATE recommendation_requests
          SET final_letter_text = ${finalText}, updated_at = NOW()
          WHERE id = ${requestId}
        `
        await logRecommendationAudit({
          requestId,
          actorType: "instructor",
          actorId: id,
          action: "final_text_edited",
          details: {},
        })
      }
    } else if (action === "notify_student_letter_ready") {
      const currentRows = sqlRows(
        await sql`
        SELECT final_letter_text FROM recommendation_requests WHERE id = ${requestId} LIMIT 1
      `,
      )
      const currentText = String(currentRows[0]?.final_letter_text ?? "")
      const finalText =
        body.finalLetterText != null && String(body.finalLetterText).trim() !== ""
          ? String(body.finalLetterText)
          : currentText
      if (!finalText.trim()) {
        return NextResponse.json({ error: "Add letter text before notifying the student." }, { status: 400 })
      }

      const st = String(row.status)
      if (!instructorCanReleaseLetter(st)) {
        return NextResponse.json(
          { error: "Approve the request before notifying the student about their letter." },
          { status: 400 },
        )
      }

      const wasAlreadyReleased = st === "finalized" || st === "downloaded"
      if (!wasAlreadyReleased) {
        await sql`
          UPDATE recommendation_requests
          SET status = 'finalized',
              final_letter_text = ${finalText},
              instructor_locked = true,
              instructor_reviewed_at = NOW(),
              updated_at = NOW()
          WHERE id = ${requestId}
        `
        await logRecommendationAudit({
          requestId,
          actorType: "instructor",
          actorId: id,
          action: "finalized",
          details: { via: "notify_student_letter_ready" },
        })
      } else {
        await sql`
          UPDATE recommendation_requests
          SET final_letter_text = ${finalText}, updated_at = NOW()
          WHERE id = ${requestId}
        `
        await logRecommendationAudit({
          requestId,
          actorType: "instructor",
          actorId: id,
          action: "letter_ready_renotified",
          details: {},
        })
      }

      const studentRow = sqlRows<{ student_id: number; is_guest: boolean }>(
        await sql`
        SELECT r.student_id,
          COALESCE(s.is_platform_guest, false) AS is_guest
        FROM recommendation_requests r
        JOIN students s ON s.id = r.student_id
        WHERE r.id = ${requestId}
        LIMIT 1
      `,
      )
      const studentInternalId = studentRow[0]?.student_id
      const studentRecLink = recommendationStudentRequestPath(
        requestId,
        studentRow[0]?.is_guest === true,
      )

      let inAppNotified = false
      if (studentInternalId != null) {
        try {
          await sql`
            INSERT INTO notifications (student_id, type, title, message, link, is_read, created_at)
            VALUES (
              ${studentInternalId},
              'recommendation_letter_ready',
              ${`Recommendation · letter ready (#${requestId})`},
              ${`Your instructor released your recommendation letter — open the request to download the PDF or ask for changes.`},
              ${studentRecLink},
              false,
              NOW()
            )
          `
          inAppNotified = true
        } catch {
          /* notifications table may be missing */
        }
      }

      let emailSent = false
      let emailSkipReason: string | undefined
      let studentEmail: string | null = null
      try {
        const emailRow = sqlRows<{ student_email: string | null }>(
          await sql`
          SELECT s.email AS student_email
          FROM recommendation_requests r
          JOIN students s ON s.id = r.student_id
          WHERE r.id = ${requestId}
          LIMIT 1
        `,
        )
        studentEmail = emailRow[0]?.student_email?.trim() || null
        const emailResult = await notifyRecommendationStudent(requestId, "letter_ready_for_student_review")
        emailSent = emailResult.sent
        emailSkipReason = emailResult.skipReason
        if (!emailResult.sent) {
          console.warn("[instructor rec patch] student letter-ready email skipped:", emailResult.skipReason)
        }
      } catch (e) {
        console.error("[instructor rec patch] student email letter_ready:", e)
        emailSkipReason = e instanceof Error ? e.message : "email_send_failed"
      }

      patchExtras = {
        studentNotification: {
          emailSent,
          emailSkipReason: emailSkipReason ?? null,
          studentEmail,
          inAppNotified,
          wasAlreadyReleased,
        },
      }
    } else if (action === "request_student_revision" || action === "request_student_changes") {
      const note = String(body.note ?? "").trim()
      if (!note) {
        return NextResponse.json(
          { error: "Add a short note so the student knows what to fix before resubmitting." },
          { status: 400 },
        )
      }
      const stIncoming = String(row.status)
      if (stIncoming !== "student_selected" && stIncoming !== "instructor_review_pending") {
        return NextResponse.json(
          {
            error:
              "Request revisions only when a letter is waiting for your review (after the student submits it).",
          },
          { status: 400 },
        )
      }
      const studentRow = sqlRows<{ student_id: number; is_guest: boolean }>(
        await sql`
        SELECT r.student_id,
          COALESCE(s.is_platform_guest, false) AS is_guest
        FROM recommendation_requests r
        JOIN students s ON s.id = r.student_id
        WHERE r.id = ${requestId}
        LIMIT 1
      `,
      )
      const studentInternalId = studentRow[0]?.student_id
      const studentRecLink = recommendationStudentRequestPath(
        requestId,
        studentRow[0]?.is_guest === true,
      )

      await sql`
        UPDATE recommendation_requests
        SET status = 'revision_requested', info_request_note = ${note}, updated_at = NOW()
        WHERE id = ${requestId}
      `
      await logRecommendationAudit({
        requestId,
        actorType: "instructor",
        actorId: id,
        action: "revision_requested_from_instructor",
        details: { note },
      })

      if (studentInternalId != null) {
        try {
          await sql`
            INSERT INTO notifications (student_id, type, title, message, link, is_read, created_at)
            VALUES (
              ${studentInternalId},
              'recommendation_revision',
              ${`Recommendation · changes requested (#${requestId})`},
              ${`Your instructor asked you to update this request before final approval.`},
              ${studentRecLink},
              false,
              NOW()
            )
          `
        } catch {
          /* notifications table may be missing */
        }
      }
      try {
        await notifyRecommendationStudent(requestId, "revision_requested", { note })
      } catch (e) {
        console.error("[instructor rec patch] student email revision_requested:", e)
      }
    } else if (action === "lock") {
      await sql`
        UPDATE recommendation_requests SET instructor_locked = true, updated_at = NOW() WHERE id = ${requestId}
      `
    } else if (action === "unlock") {
      await sql`
        UPDATE recommendation_requests SET instructor_locked = false, updated_at = NOW() WHERE id = ${requestId}
      `
    } else if (action === "set_delivery_method") {
      const deliveryMethod = normalizeDeliveryMethod(body.deliveryMethod ?? body.delivery_method)
      const recipientEmail =
        body.designatedRecipientEmail != null ? String(body.designatedRecipientEmail).trim() : null
      await sql`
        UPDATE recommendation_requests
        SET delivery_method = ${deliveryMethod},
            designated_recipient_email = ${deliveryMethod === "designated_recipient" ? recipientEmail : null},
            updated_at = NOW()
        WHERE id = ${requestId}
      `
      await logRecommendationAudit({
        requestId,
        actorType: "instructor",
        actorId: id,
        action: "delivery_method_set",
        details: { deliveryMethod },
      })
    } else if (action === "mark_delivered") {
      await sql`
        UPDATE recommendation_requests
        SET status = 'delivered',
            delivered_at = NOW(),
            updated_at = NOW()
        WHERE id = ${requestId}
      `
      await logRecommendationAudit({
        requestId,
        actorType: "instructor",
        actorId: id,
        action: "delivered",
        details: {},
      })
      try {
        await notifyRecommendationStudent(requestId, "finalized")
      } catch (e) {
        console.error("[instructor rec patch] student email delivered:", e)
      }
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }

    const updated = sqlRows(await sql`SELECT * FROM recommendation_requests WHERE id = ${requestId} LIMIT 1`)
    return NextResponse.json({ request: updated[0], ...patchExtras })
  } catch (e) {
    console.error("[instructor rec patch]", e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response
    const id = session.instructorId
    const scoped = await resolveOptionalCourseScope(request)
    if (!scoped.ok) return scoped.response
    if (scoped.courseId != null && String(scoped.instructorId ?? "") !== String(id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)

    const existing = sqlRows<{ status: string }>(
      await sql`
      SELECT r.status FROM recommendation_requests r
      WHERE r.id = ${requestId} AND r.instructor_id = ${id}
      LIMIT 1
    `,
    )
    if (existing.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const prev = String(existing[0].status)

    await logRecommendationAudit({
      requestId,
      actorType: "instructor",
      actorId: id,
      action: "request_deleted",
      details: { previousStatus: prev },
    })

    await sql`DELETE FROM recommendation_requests WHERE id = ${requestId} AND instructor_id = ${id}`

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[instructor rec delete]", e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
