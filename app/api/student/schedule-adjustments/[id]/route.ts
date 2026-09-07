import { type NextRequest, NextResponse } from "next/server"
import { resolveStudentCourseContextFromRequest } from "@/lib/student-course-scope"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"
import { sql } from "@/lib/db"
import { rowToRequest, syncRequestStatus, getConsentCounts } from "@/lib/schedule-adjustment/workflow-service"
import { getConsentThresholdPercent } from "@/lib/schedule-adjustment/finalize"
import { consentProgressSummary } from "@/lib/schedule-adjustment/validate"
import {
  CONFLICT_DISCLAIMER,
  CONSENT_STATEMENT,
  CONSENT_STATEMENT_DIRECT,
  DIRECT_PROPOSAL_CONSENT_AFFIRMATIONS,
  DIRECT_PROPOSAL_CONSENT_INTRO,
  INSTITUTIONAL_SAFEGUARD_NOTICE,
  isDirectProposal,
} from "@/lib/schedule-adjustment/types"
import { proposedArrangementStored } from "@/lib/schedule-adjustment/arrangement"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const auth = await requireStudentIdParamMatchesCaller(request, studentId)
    if (!auth.ok) return auth.response

    const resolved = await resolveStudentCourseContextFromRequest(request)
    if (!resolved.ok) return resolved.response

    const { id } = await context.params
    const requestId = Number(id)

    const rows = await sql`
      SELECT r.*
      FROM schedule_adjustment_requests r
      WHERE r.id = ${requestId} AND r.course_id = ${resolved.ctx.courseId}
      LIMIT 1
    `
    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const req = await syncRequestStatus(rowToRequest(rows[0] as Record<string, unknown>))
    if (req.status === "DRAFT") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const snap = await sql`
      SELECT 1 FROM schedule_enrollment_snapshots
      WHERE request_id = ${requestId} AND student_id = ${resolved.ctx.studentDbId}
      LIMIT 1
    `
    if (!snap.length) return NextResponse.json({ error: "Not enrolled in this adjustment" }, { status: 403 })

    const availability = await sql`
      SELECT availability_data, submitted_at, updated_at
      FROM schedule_availability_responses
      WHERE request_id = ${requestId} AND student_id = ${resolved.ctx.studentDbId}
      LIMIT 1
    `

    const consent = await sql`
      SELECT status, signature_name, signed_at, decline_reason, decline_category, document_version
      FROM schedule_consents
      WHERE request_id = ${requestId}
        AND student_id = ${resolved.ctx.studentDbId}
        AND document_version = ${req.consent_document_version}
      LIMIT 1
    `

    const respondedCount = await sql`
      SELECT COUNT(*)::int AS c FROM schedule_availability_responses
      WHERE request_id = ${requestId} AND submitted_at IS NOT NULL
    `
    const enrolledCount = await sql`
      SELECT COUNT(*)::int AS c FROM schedule_enrollment_snapshots WHERE request_id = ${requestId}
    `
    const identity = await sql`
      SELECT
        COALESCE(NULLIF(TRIM(st.full_name), ''), st.student_id) AS student_name,
        COALESCE(NULLIF(TRIM(i.name), ''), i.username) AS instructor_name
      FROM students st
      LEFT JOIN instructors i ON i.id = ${req.created_by_id}
      WHERE st.id = ${resolved.ctx.studentDbId}
      LIMIT 1
    `

    const consentCounts = await getConsentCounts(requestId)
    const thresholdPercent = await getConsentThresholdPercent()
    const consentStats = consentProgressSummary(consentCounts, thresholdPercent)

    return NextResponse.json({
      success: true,
      request: req,
      myAvailability: availability[0] ?? null,
      myConsent: consent[0] ?? null,
      pollStats: {
        responded: Number((respondedCount[0] as { c: number } | undefined)?.c ?? 0),
        enrolled: Number((enrolledCount[0] as { c: number } | undefined)?.c ?? 0),
      },
      consentStats,
      consentStatement: isDirectProposal(req.adjustment_mode)
        ? CONSENT_STATEMENT_DIRECT
        : CONSENT_STATEMENT,
      consentIntro: isDirectProposal(req.adjustment_mode) ? DIRECT_PROPOSAL_CONSENT_INTRO : null,
      consentAffirmations: isDirectProposal(req.adjustment_mode)
        ? DIRECT_PROPOSAL_CONSENT_AFFIRMATIONS
        : null,
      arrangement: proposedArrangementStored(req),
      studentName: (identity[0] as { student_name?: string } | undefined)?.student_name ?? null,
      instructorName: (identity[0] as { instructor_name?: string } | undefined)?.instructor_name ?? null,
      safeguardNotice: INSTITUTIONAL_SAFEGUARD_NOTICE,
      conflictDisclaimer: CONFLICT_DISCLAIMER,
    })
  } catch (error) {
    console.error("[Student schedule adjustment GET]", error)
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 })
  }
}
