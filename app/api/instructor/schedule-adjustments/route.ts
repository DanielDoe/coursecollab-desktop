import { type NextRequest, NextResponse } from "next/server"
import { requireCoursePermission } from "@/lib/course-permission-guard"
import {
  createScheduleAdjustmentRequest,
  listCourseRequests,
} from "@/lib/schedule-adjustment/workflow-service"
import { validateAvailabilityWindow } from "@/lib/schedule-adjustment/validate"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const ctx = await requireCoursePermission(request, [
    "manage_course_settings",
    "view_course_content",
    "view_analytics",
  ])
  if (!ctx.ok) return ctx.response

  try {
    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get("includeArchived") === "1"
    const sessionScope = readInstructorSessionScopeFromRequest(request)
    const requests = await listCourseRequests(ctx.course.id, {
      includeArchived,
      sectionId: sessionScope.sessionId,
    })
    return NextResponse.json({ success: true, requests })
  } catch (error) {
    console.error("[Schedule Adjustments GET]", error)
    return NextResponse.json({ success: true, requests: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCoursePermission(
      request,
      ["manage_course_settings"],
      "Only instructors with course settings access can create schedule adjustments.",
    )
    if (!ctx.ok) return ctx.response
    if (!ctx.isInstructorOwner) {
      return NextResponse.json(
        { error: "Teaching assistants cannot create schedule adjustments." },
        { status: 403 },
      )
    }

    const body = await request.json()
    if (!String(body.reason ?? "").trim()) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 })
    }
    if (!body.availabilityEndsAt) {
      return NextResponse.json({ error: "Availability deadline is required" }, { status: 400 })
    }

    const sectionRows = await sql`
      SELECT id, code FROM sessions
      WHERE course_id = ${ctx.course.id}
        AND TRIM(UPPER(code)) <> 'BETA'
      ORDER BY code
      LIMIT 1
    `
    const defaultSection = sectionRows[0] as { id: number; code: string } | undefined
    let sectionId = defaultSection?.id ?? null
    let sectionCode = defaultSection?.code ?? null

    const sessionScope = readInstructorSessionScopeFromRequest(request)
    if (sessionScope.sessionId != null) {
      const scoped = await sql`
        SELECT id, code FROM sessions
        WHERE id = ${sessionScope.sessionId}
          AND course_id = ${ctx.course.id}
          AND TRIM(UPPER(code)) <> 'BETA'
        LIMIT 1
      `
      if (scoped.length) {
        sectionId = Number((scoped[0] as { id: number }).id)
        sectionCode = String((scoped[0] as { code: string }).code)
      }
    }

    if (body.sectionId != null) {
      const owned = await sql`
        SELECT id, code FROM sessions
        WHERE id = ${Number(body.sectionId)} AND course_id = ${ctx.course.id}
        LIMIT 1
      `
      if (!owned.length) {
        return NextResponse.json({ error: "Section does not belong to this course" }, { status: 400 })
      }
      const ownedCode = String((owned[0] as { code: string }).code)
      if (ownedCode.trim().toUpperCase() === "BETA") {
        return NextResponse.json(
          { error: "BETA sections cannot be used for schedule adjustments." },
          { status: 400 },
        )
      }
      sectionId = Number((owned[0] as { id: number }).id)
      sectionCode = ownedCode
    }
    if (sectionId == null) {
      return NextResponse.json(
        { error: "No eligible section found. BETA sections cannot be used for schedule adjustments." },
        { status: 400 },
      )
    }

    const pollKind = body.pollKind === "one_off" ? "one_off" : "recurring"
    const candidateDays = body.candidateDays ?? (pollKind === "recurring" ? ["MO", "TU", "WE", "TH"] : [])
    const candidateDates = Array.isArray(body.candidateDates) ? body.candidateDates : []
    const missedClassDate = body.missedClassDate ? String(body.missedClassDate).slice(0, 10) : null
    const windowError = validateAvailabilityWindow({
      pollKind,
      candidateStartTime: body.candidateStartTime ?? "08:00:00",
      candidateEndTime: body.candidateEndTime ?? "17:00:00",
      meetingDurationMinutes: Number(body.meetingDurationMinutes ?? 110),
      slotIncrementMinutes: Number(body.slotIncrementMinutes ?? 30),
      availabilityEndsAt: String(body.availabilityEndsAt),
      candidateDays,
      candidateDates,
      missedClassDate,
    })
    if (windowError) {
      return NextResponse.json({ error: windowError }, { status: 400 })
    }

    const created = await createScheduleAdjustmentRequest({
      courseId: ctx.course.id,
      sectionId,
      sectionCode: body.sectionCode ?? sectionCode,
      createdById: ctx.instructorId,
      meetingType: body.meetingType ?? "lecture",
      reason: String(body.reason ?? "").trim(),
      availabilityStartsAt: body.availabilityStartsAt ?? null,
      availabilityEndsAt: body.availabilityEndsAt,
      candidateDays,
      candidateStartTime: body.candidateStartTime ?? "08:00:00",
      candidateEndTime: body.candidateEndTime ?? "17:00:00",
      meetingDurationMinutes: Number(body.meetingDurationMinutes ?? 110),
      slotIncrementMinutes: body.slotIncrementMinutes ?? 30,
      allowMultipleSelections: body.allowMultipleSelections !== false,
      availabilityMode: body.availabilityMode ?? "binary",
      instructorNotes: body.instructorNotes ?? null,
      courseTitle: ctx.course.course_title,
      pollKind,
      candidateDates,
      missedClassDate,
    })

    return NextResponse.json({ success: true, request: created })
  } catch (error) {
    console.error("[Schedule Adjustments POST]", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create request" },
      { status: 500 },
    )
  }
}
