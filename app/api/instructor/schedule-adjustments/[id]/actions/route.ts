import { type NextRequest, NextResponse } from "next/server"
import { requireCoursePermission } from "@/lib/course-permission-guard"
import { savePublicUpload } from "@/lib/blob-or-local-public"
import {
  approvalBlobKey,
  approvalFileProxyPath,
  isOwnedApprovalAttachment,
} from "@/lib/schedule-adjustment/approval-attachment"
import {
  cancelRequest,
  closeAvailabilityPoll,
  reactivateRequest,
  finalizeRequest,
  getAvailabilityAggregate,
  getRequestById,
  invalidateConsentsOnProposalChange,
  recordDepartmentConfirmation,
  refreshEnrollmentBeforeConsent,
  remindAvailability,
  remindPendingConsent,
  runCandidateAnalysis,
  selectCandidate,
  startAvailabilityCollection,
  startStudentConsent,
  convertToDirectProposal,
  getConsentRoster,
  updateDraftRequest,
  deleteDraftRequest,
  archiveScheduleAdjustmentRequest,
  unarchiveScheduleAdjustmentRequest,
} from "@/lib/schedule-adjustment/workflow-service"
import { sql } from "@/lib/db"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"
import { instructorCanAccessScheduleRequest } from "@/lib/schedule-adjustment/section-scope"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const requestId = Number(id)
    const contentType = request.headers.get("content-type") ?? ""

    if (contentType.includes("multipart/form-data")) {
      const ctx = await requireCoursePermission(request, ["manage_course_settings"])
      if (!ctx.ok) return ctx.response
      if (!ctx.isInstructorOwner) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const existing = await getRequestById(requestId)
      if (!existing || !instructorCanAccessScheduleRequest(existing, ctx.course.id, readInstructorSessionScopeFromRequest(request).sessionId)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }

      const form = await request.formData()
      const file = form.get("file") as File | null
      if (!file?.size) return NextResponse.json({ error: "file required" }, { status: 400 })
      const buf = Buffer.from(await file.arrayBuffer())
      const ext = (file.name.split(".").pop() || "pdf").slice(0, 8)
      const blobKey = approvalBlobKey(requestId, ext)
      await savePublicUpload({
        blobKey,
        relativePublicPath: blobKey,
        bytes: buf,
        contentType: file.type || "application/octet-stream",
      })
      return NextResponse.json({
        success: true,
        fileKey: blobKey,
        url: approvalFileProxyPath(requestId),
      })
    }

    const ctx = await requireCoursePermission(request, ["manage_course_settings"])
    if (!ctx.ok) return ctx.response

    const existing = await getRequestById(requestId)
    if (!existing || !instructorCanAccessScheduleRequest(existing, ctx.course.id, readInstructorSessionScopeFromRequest(request).sessionId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await request.json()
    const action = String(body.action ?? "")

    const ownerOnly = new Set([
      "start_availability",
      "close_availability",
      "select_candidate",
      "record_department",
      "start_consent",
      "refresh_enrollment",
      "finalize",
      "cancel",
      "reactivate",
      "remind_consent",
      "remind_availability",
      "reanalyze",
      "invalidate_consents",
      "save_announcement_draft",
      "update",
      "delete",
      "archive",
      "unarchive",
      "convert_to_direct_proposal",
    ])
    if (ownerOnly.has(action) && !ctx.isInstructorOwner) {
      return NextResponse.json({ error: "Teaching assistants cannot perform this action." }, { status: 403 })
    }

    switch (action) {
      case "start_availability": {
        const updated = await startAvailabilityCollection(requestId, ctx.instructorId)
        return NextResponse.json({ success: true, request: updated })
      }
      case "close_availability": {
        const updated = await closeAvailabilityPoll(requestId, ctx.instructorId)
        return NextResponse.json({ success: true, request: updated })
      }
      case "reanalyze": {
        const candidates = await runCandidateAnalysis(requestId)
        return NextResponse.json({ success: true, candidateCount: candidates.length })
      }
      case "select_candidate": {
        const updated = await selectCandidate(requestId, Number(body.candidateId), ctx.instructorId)
        return NextResponse.json({ success: true, request: updated })
      }
      case "record_department": {
        const attachmentUrl = String(body.attachmentUrl ?? body.fileKey ?? "") || null
        if (!isOwnedApprovalAttachment(requestId, attachmentUrl)) {
          return NextResponse.json({ error: "Invalid approval attachment" }, { status: 400 })
        }
        const updated = await recordDepartmentConfirmation(requestId, ctx.instructorId, {
          approvalStatus: body.approvalStatus ?? "pending",
          approvedBy: body.approvedBy ?? null,
          approvalDate: body.approvalDate ?? null,
          building: body.building ?? null,
          room: body.room ?? null,
          notes: body.notes ?? null,
          attachmentUrl,
          approvalReference: body.approvalReference ?? null,
          confirmationChecked: body.confirmationChecked === true,
          effectiveDate: body.effectiveDate ?? null,
        })
        return NextResponse.json({ success: true, request: updated })
      }
      case "convert_to_direct_proposal": {
        const updated = await convertToDirectProposal(requestId, ctx.instructorId, {
          instructorLedDay: String(body.instructorLedDay ?? ""),
          instructorLedStartTime: String(body.instructorLedStartTime ?? ""),
          instructorLedEndTime: String(body.instructorLedEndTime ?? ""),
          structuredSessionDay: String(body.structuredSessionDay ?? ""),
          structuredSessionStartTime: String(body.structuredSessionStartTime ?? ""),
          structuredSessionEndTime: String(body.structuredSessionEndTime ?? ""),
          effectiveDate: String(body.effectiveDate ?? "").slice(0, 10),
          reason: body.reason ?? null,
          instructorNotes: body.instructorNotes ?? null,
          departmentNote: body.departmentNote ?? null,
          lateThresholdMinutes: Number(body.lateThresholdMinutes ?? 20),
          confirmed: body.confirmed === true,
        })
        return NextResponse.json({ success: true, request: updated })
      }
      case "start_consent": {
        const updated = await startStudentConsent(requestId, ctx.instructorId)
        return NextResponse.json({ success: true, request: updated })
      }
      case "refresh_enrollment": {
        const delta = await refreshEnrollmentBeforeConsent(requestId, ctx.instructorId)
        return NextResponse.json({ success: true, delta })
      }
      case "remind_consent": {
        const count = await remindPendingConsent(requestId)
        return NextResponse.json({ success: true, reminded: count })
      }
      case "remind_availability": {
        const count = await remindAvailability(requestId)
        return NextResponse.json({ success: true, reminded: count })
      }
      case "save_announcement_draft": {
        await sql`
          UPDATE schedule_adjustment_requests
          SET announcement_draft = ${JSON.stringify({ title: body.title, content: body.content })}::jsonb,
              updated_at = NOW()
          WHERE id = ${requestId}
        `
        return NextResponse.json({ success: true })
      }
      case "finalize": {
        const updated = await finalizeRequest({
          requestId,
          actorId: ctx.instructorId,
          confirmText: String(body.confirmText ?? ""),
          announcementTitle: body.announcementTitle,
          announcementContent: body.announcementContent,
        })
        return NextResponse.json({ success: true, request: updated })
      }
      case "cancel": {
        const reason = String(body.reason ?? "").trim()
        if (!reason) {
          return NextResponse.json({ error: "Cancellation reason is required" }, { status: 400 })
        }
        await cancelRequest(requestId, ctx.instructorId, reason)
        return NextResponse.json({ success: true })
      }
      case "reactivate": {
        const updated = await reactivateRequest(requestId, ctx.instructorId)
        return NextResponse.json({ success: true, request: updated })
      }
      case "update": {
        const pollKind = body.pollKind === "one_off" ? "one_off" : "recurring"
        const candidateDays = body.candidateDays ?? (pollKind === "recurring" ? ["MO", "TU", "WE", "TH", "FR"] : [])
        const candidateDates = Array.isArray(body.candidateDates) ? body.candidateDates : []
        const missedClassDate = body.missedClassDate ? String(body.missedClassDate).slice(0, 10) : null
        const updated = await updateDraftRequest(requestId, ctx.instructorId, {
          meetingType: body.meetingType ?? "lecture",
          reason: String(body.reason ?? "").trim(),
          availabilityEndsAt: String(body.availabilityEndsAt),
          candidateDays,
          candidateStartTime: body.candidateStartTime ?? "08:00:00",
          candidateEndTime: body.candidateEndTime ?? "17:00:00",
          meetingDurationMinutes: Number(body.meetingDurationMinutes ?? 110),
          slotIncrementMinutes: body.slotIncrementMinutes ?? 30,
          allowMultipleSelections: body.allowMultipleSelections !== false,
          availabilityMode: body.availabilityMode ?? "binary",
          instructorNotes: body.instructorNotes ?? null,
          pollKind,
          candidateDates,
          missedClassDate,
        })
        return NextResponse.json({ success: true, request: updated })
      }
      case "delete": {
        await deleteDraftRequest(requestId, ctx.instructorId)
        return NextResponse.json({ success: true, deleted: true })
      }
      case "archive": {
        const updated = await archiveScheduleAdjustmentRequest(requestId, ctx.instructorId)
        return NextResponse.json({ success: true, request: updated })
      }
      case "unarchive": {
        const updated = await unarchiveScheduleAdjustmentRequest(requestId, ctx.instructorId)
        return NextResponse.json({ success: true, request: updated })
      }
      case "invalidate_consents": {
        await invalidateConsentsOnProposalChange(requestId)
        return NextResponse.json({ success: true })
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (error) {
    console.error("[Schedule Adjustment action]", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Action failed" },
      { status: 400 },
    )
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireCoursePermission(request, [
      "manage_course_settings",
      "view_course_content",
      "view_analytics",
    ])
    if (!ctx.ok) return ctx.response

    const { id } = await context.params
    const requestId = Number(id)
    const { searchParams } = new URL(request.url)
    const view = searchParams.get("view")

    const existing = await getRequestById(requestId)
    if (!existing || !instructorCanAccessScheduleRequest(existing, ctx.course.id, readInstructorSessionScopeFromRequest(request).sessionId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (view === "availability") {
      const rows = await sql`
        SELECT r.student_id, r.availability_data, r.submitted_at, r.updated_at,
               s.student_display_name
        FROM schedule_availability_responses r
        JOIN schedule_enrollment_snapshots s
          ON s.request_id = r.request_id AND s.student_id = r.student_id
        WHERE r.request_id = ${requestId}
        ORDER BY s.student_display_name ASC
      `
      return NextResponse.json({ success: true, responses: rows })
    }

    if (view === "consents") {
      const tab = searchParams.get("tab") ?? "all"
      const rows = await getConsentRoster(requestId, tab)
      return NextResponse.json({ success: true, consents: rows })
    }

    if (view === "candidates") {
      const rows = await sql`
        SELECT * FROM schedule_candidates
        WHERE request_id = ${requestId}
        ORDER BY agreement_percentage DESC, preferred_count DESC
      `
      return NextResponse.json({ success: true, candidates: rows })
    }

    if (view === "aggregate") {
      const aggregate = await getAvailabilityAggregate(requestId)
      return NextResponse.json({ success: true, aggregate })
    }

    if (view === "audit") {
      const rows = await sql`
        SELECT * FROM schedule_audit_logs
        WHERE request_id = ${requestId}
        ORDER BY created_at ASC
      `
      return NextResponse.json({ success: true, audit: rows })
    }

    if (view === "versions") {
      const rows = await sql`
        SELECT * FROM course_schedule_versions
        WHERE course_id = ${ctx.course.id}
        ORDER BY version ASC, meeting_type ASC
      `
      return NextResponse.json({ success: true, versions: rows })
    }

    return NextResponse.json({ error: "Unknown view" }, { status: 400 })
  } catch (error) {
    console.error("[Schedule Adjustment detail GET]", error)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}
