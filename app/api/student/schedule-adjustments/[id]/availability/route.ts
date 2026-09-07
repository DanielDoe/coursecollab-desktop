import { type NextRequest, NextResponse } from "next/server"
import { resolveStudentCourseContextFromRequest } from "@/lib/student-course-scope"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"
import {
  assertStudentCanAccessRequest,
  getAvailabilityAggregate,
  submitStudentAvailability,
} from "@/lib/schedule-adjustment/workflow-service"
import { generateTimeSlots } from "@/lib/schedule-adjustment/time-slots"
import { formatPollColumnLabel, pollColumns } from "@/lib/schedule-adjustment/poll-scope"
import {
  blockedSlotKeysFromBusyWindows,
  loadBusyWindowsForRequest,
} from "@/lib/schedule-adjustment/instructor-busy-blocks"

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
    let req
    try {
      req = await assertStudentCanAccessRequest({
        requestId: Number(id),
        studentDbId: resolved.ctx.studentDbId,
        courseId: resolved.ctx.courseId,
      })
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const slots = generateTimeSlots(
      req.candidate_start_time,
      req.candidate_end_time,
      req.slot_increment_minutes,
    )
    const columns = pollColumns({
      pollKind: req.poll_kind,
      candidateDays: req.candidate_days,
      candidateDates: req.candidate_dates,
    })

    const aggregate =
      req.status === "COLLECTING_AVAILABILITY" ? await getAvailabilityAggregate(Number(id)) : null

    const busyWindows = await loadBusyWindowsForRequest(req)
    const blockedSlotKeys = [
      ...blockedSlotKeysFromBusyWindows(columns, slots, busyWindows),
    ]

    return NextResponse.json({
      success: true,
      pollKind: req.poll_kind,
      missedClassDate: req.missed_class_date,
      candidateDays: columns,
      candidateDates: req.candidate_dates,
      columnLabels: Object.fromEntries(columns.map((col) => [col, formatPollColumnLabel(col)])),
      timeSlots: slots,
      slotIncrementMinutes: req.slot_increment_minutes,
      availabilityMode: req.availability_mode,
      allowMultipleSelections: req.allow_multiple_selections,
      deadline: req.availability_ends_at,
      meetingDurationMinutes: req.meeting_duration_minutes,
      blockedSlotKeys,
      pollStats: aggregate
        ? { responded: aggregate.responded, enrolled: aggregate.totalEnrolled, responseRate: aggregate.responseRate }
        : null,
      slotHeatmap: aggregate?.slotHeatmap ?? null,
      topWindows: aggregate?.topWindows ?? null,
    })
  } catch (error) {
    console.error("[Student availability grid GET]", error)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}

export async function POST(
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
    try {
      await assertStudentCanAccessRequest({
        requestId: Number(id),
        studentDbId: resolved.ctx.studentDbId,
        courseId: resolved.ctx.courseId,
      })
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const body = await request.json()

    await submitStudentAvailability({
      requestId: Number(id),
      studentId: resolved.ctx.studentDbId,
      availability: body.availability ?? { slots: body.slots ?? {} },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Student availability POST]", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to submit" },
      { status: 400 },
    )
  }
}
