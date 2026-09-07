import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import {
  getActiveSemesterKey,
  logRecommendationAudit,
  RECOMMENDATION_PURPOSES,
  ensureInstructorRecommendationSettings,
} from "@/lib/recommendation-letters"
import { notifyRecommendationInstructor } from "@/lib/recommendation-instructor-email"
import { notifyRecommendationStudent } from "@/lib/recommendation-student-email"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

function parsePurpose(v: string): string | null {
  const p = v.trim().toLowerCase().replace(/[\s-]+/g, "_")
  return (RECOMMENDATION_PURPOSES as readonly string[]).includes(p) ? p : null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const raw = (searchParams.get("studentDatabaseId") ?? searchParams.get("studentId") ?? "").trim()
    const bound = await requireBoundStudentCaller(request, raw || null)
    if (!bound.ok) return bound.response
    const dbId = bound.studentDbId

    const rows = sqlRows(
      await sql`
      SELECT r.*,
        sess.code AS course_code,
        sess.description AS course_description,
        i.name AS instructor_name,
        (SELECT COUNT(*)::int FROM recommendation_drafts d WHERE d.request_id = r.id) AS draft_count,
        EXISTS (SELECT 1 FROM recommendation_profiles rp WHERE rp.request_id = r.id) AS has_questionnaire_profile
      FROM recommendation_requests r
      JOIN sessions sess ON sess.id = r.course_id
      JOIN instructors i ON i.id = r.instructor_id
      WHERE r.student_id = ${dbId}
      ORDER BY r.created_at DESC
    `,
    )
    return NextResponse.json({ requests: rows })
  } catch (e) {
    console.error("[recommendations list]", e)
    return NextResponse.json({ error: "Failed to list requests" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rawStudent = String(body.studentDatabaseId ?? body.studentId ?? "").trim()
    const bound = await requireBoundStudentCaller(request, rawStudent || null)
    if (!bound.ok) return bound.response
    const dbId = bound.studentDbId

    const courseId = Number(body.courseId ?? body.course_id)
    const instructorId = Number(body.instructorId ?? body.instructor_id)
    const purposeRaw = String(body.purpose ?? "")
    const purpose = parsePurpose(purposeRaw)
    if (!purpose) return NextResponse.json({ error: "Invalid purpose" }, { status: 400 })
    if (!Number.isFinite(courseId) || !Number.isFinite(instructorId)) {
      return NextResponse.json({ error: "course and instructor required" }, { status: 400 })
    }

    const deadlineStr = body.deadline ? String(body.deadline) : null
    const recipientName = body.recipientName != null ? String(body.recipientName) : null
    const recipientOrganization =
      body.recipientOrganization != null ? String(body.recipientOrganization) : null
    const letterIsSpecific = Boolean(body.letterIsSpecific ?? body.letter_is_specific)
    const recipientAddressRaw =
      body.recipientAddress != null || body.recipient_address != null
        ? String(body.recipientAddress ?? body.recipient_address ?? "").trim().slice(0, 2000)
        : ""
    const recipientAddress =
      letterIsSpecific && recipientAddressRaw ? recipientAddressRaw : null
    const studentRequestDescription =
      body.studentRequestDescription != null || body.student_request_description != null
        ? String(body.studentRequestDescription ?? body.student_request_description).trim().slice(0, 4000)
        : null
    if (studentRequestDescription !== null && studentRequestDescription.length === 0) {
      return NextResponse.json({ error: "Description cannot be only whitespace" }, { status: 400 })
    }

    await ensureInstructorRecommendationSettings(instructorId)
    const settingsRows = sqlRows(
      await sql`
      SELECT * FROM recommendation_settings WHERE instructor_id = ${instructorId} LIMIT 1
    `,
    )
    const settings = settingsRows[0] as { enabled: boolean; max_requests_per_semester: number; minimum_notice_days: number; require_purpose_deadline: boolean } | undefined
    if (!settings?.enabled) {
      return NextResponse.json({ error: "This instructor is not accepting recommendation requests right now." }, { status: 403 })
    }

    if (settings.require_purpose_deadline) {
      if (!deadlineStr) {
        return NextResponse.json({ error: "Deadline is required" }, { status: 400 })
      }
    }

    let deadline: string | null = null
    if (deadlineStr) {
      const d = new Date(deadlineStr)
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid deadline" }, { status: 400 })
      }
      deadline = d.toISOString().slice(0, 10)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const noticeMs = Math.max(0, Number(settings.minimum_notice_days) || 0) * 86400000
      if (d.getTime() < today.getTime() + noticeMs) {
        return NextResponse.json(
          { error: `Deadline must be at least ${settings.minimum_notice_days} day(s) from today.` },
          { status: 400 },
        )
      }
    }

    const semesterKey = (await getActiveSemesterKey()) ?? "unknown"
    const used = sqlRows<{ c: number }>(
      await sql`
      SELECT COUNT(*)::int AS c FROM recommendation_requests
      WHERE student_id = ${dbId} AND semester_key = ${semesterKey}
    `,
    )
    const count = Number(used[0]?.c ?? 0)
    if (count >= (settings.max_requests_per_semester ?? 3)) {
      return NextResponse.json(
        { error: "You have reached the maximum recommendation requests for this term." },
        { status: 403 },
      )
    }

    let purposeOtherDetail: string | null = null
    if (purpose === "other") {
      const detail = String(
        (body as Record<string, unknown>).purposeOtherDetail ??
          (body as Record<string, unknown>).purpose_other_detail ??
          "",
      )
        .trim()
        .slice(0, 500)
      if (detail.length < 2) {
        return NextResponse.json(
          {
            error:
              'When purpose is "Other", add a short phrase (2+ characters) for the formal letter (shown after your name on the Re: line).',
          },
          { status: 400 },
        )
      }
      purposeOtherDetail = detail
    }

    const ins = sqlRows<{ id: number }>(
      await sql`
      INSERT INTO recommendation_requests (
        student_id, instructor_id, course_id, purpose, purpose_other_detail,
        recipient_name, recipient_organization, recipient_address,
        deadline, letter_is_specific, status, semester_key, student_request_description
      ) VALUES (
        ${dbId}, ${instructorId}, ${courseId}, ${purpose}, ${purposeOtherDetail},
        ${recipientName}, ${recipientOrganization}, ${recipientAddress},
        ${deadline}, ${letterIsSpecific}, 'requested', ${semesterKey}, ${studentRequestDescription}
      )
      RETURNING id
    `,
    )
    const requestId = Number(ins[0].id)
    await logRecommendationAudit({
      requestId,
      actorType: "student",
      actorId: dbId,
      action: "request_created",
      details: { purpose, courseId, instructorId },
    })

    try {
      await notifyRecommendationStudent(requestId, "created")
    } catch (emailErr) {
      console.error("[recommendations create] student milestone email:", emailErr)
    }
    try {
      await notifyRecommendationInstructor(requestId, "new_request")
    } catch (emailErr) {
      console.error("[recommendations create] instructor milestone email:", emailErr)
    }

    return NextResponse.json({ id: requestId })
  } catch (e) {
    console.error("[recommendations create]", e)
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 })
  }
}
