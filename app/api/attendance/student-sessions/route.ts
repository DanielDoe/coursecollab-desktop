import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizeAttendanceDbTimestamp } from "@/lib/db-timestamp"
import { getEnrollmentAttendanceWindow, termStartWithGrace } from "@/lib/attendance-enrollment-scope"
import { finalizeStructuredAbsentsForStudent } from "@/lib/attendance/self-checkin"
import { getStudentCheckInEligibility } from "@/lib/attendance/student-check-in-eligibility"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Student-facing list of section attendance sessions with check-in eligibility. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const bound = await requireBoundStudentCaller(req, searchParams.get("studentId"))
    if (!bound.ok) return bound.response

    const window = await getEnrollmentAttendanceWindow(bound.studentDbId)
    if (!window) {
      return NextResponse.json({ success: true, sessions: [], section: null })
    }

    await finalizeStructuredAbsentsForStudent(bound.studentDbId)

    const termStart = termStartWithGrace(window.termStart)
    const termEnd = window.termEnd

    const rows = (await sql`
      SELECT
        asess.id,
        asess.class_title,
        asess.start_time::text AS start_time,
        asess.end_time::text AS end_time,
        asess.qr_expires_at::text AS qr_expires_at,
        asess.is_active,
        COALESCE(asess.is_cancelled, false) AS is_cancelled,
        asess.session_type,
        COALESCE(asess.self_checkin_enabled, false) AS self_checkin_enabled,
        COALESCE(asess.late_threshold_minutes, 20) AS late_threshold_minutes,
        ar.id AS record_id,
        ar.status AS record_status,
        ar.points_earned AS record_points
      FROM attendance_sessions asess
      LEFT JOIN attendance_records ar
        ON ar.session_id = asess.id
        AND ar.student_id = ${bound.studentDbId}
      WHERE TRIM(asess.section) = TRIM(${window.sectionCode})
        AND COALESCE(asess.is_cancelled, false) = false
        AND (${termStart}::date IS NULL OR asess.start_time::date >= ${termStart}::date)
        AND (${termEnd}::date IS NULL OR asess.start_time::date <= ${termEnd}::date)
      ORDER BY asess.start_time ASC
    `) as Array<{
      id: number
      class_title: string | null
      start_time: string
      end_time: string
      qr_expires_at: string | null
      is_active: boolean
      is_cancelled: boolean
      session_type: string | null
      self_checkin_enabled: boolean
      late_threshold_minutes: number
      record_id: number | null
      record_status: string | null
      record_points: number | null
    }>

    const now = new Date()
    const sessions = rows.map((row) => {
      const startTime = normalizeAttendanceDbTimestamp(row.start_time)
      const endTime = normalizeAttendanceDbTimestamp(row.end_time)
      const qrExpiresAt = row.qr_expires_at
        ? normalizeAttendanceDbTimestamp(row.qr_expires_at)
        : null
      const hasRecord = row.record_id != null
      const sessionType = row.session_type
      const selfCheckInEnabled = row.self_checkin_enabled
      const eligibility = getStudentCheckInEligibility({
        now,
        startTime,
        endTime,
        qrExpiresAt,
        lateThresholdMinutes: row.late_threshold_minutes,
        isActive: row.is_active,
        isCancelled: row.is_cancelled,
        hasRecord,
        recordStatus: row.record_status,
        sessionType,
        selfCheckInEnabled,
      })

      return {
        id: Number(row.id),
        classTitle: row.class_title ?? "Class session",
        startTime,
        endTime,
        sessionType,
        selfCheckInEnabled,
        requireLocation: false,
        checkInStatus: eligibility.status,
        canCheckIn: eligibility.canCheckIn,
        statusMessage: eligibility.statusMessage,
        record: hasRecord
          ? {
              status: row.record_status,
              pointsEarned: Number(row.record_points ?? 0),
            }
          : null,
      }
    })

    return NextResponse.json({
      success: true,
      section: window.sectionCode,
      sessions,
      total: sessions.length,
    })
  } catch (error) {
    console.error("[student-sessions]", error)
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 })
  }
}
