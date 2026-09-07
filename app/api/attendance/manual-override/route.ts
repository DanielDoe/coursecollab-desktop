import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { CENTRAL_TIMEZONE } from "@/lib/timezone"
import { toZonedTime } from "date-fns-tz"
import {
  attendancePointsForStatus,
  isAttendanceStatus,
  type AttendanceStatus,
} from "@/lib/attendance-status"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { syncGradebookForAttendanceMark } from "@/lib/grades"
import {
  canActorAccessAttendanceSession,
  requireInstructorAttendanceAccess,
} from "@/lib/instructor-attendance-auth"
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function sectionMatches(studentSection: string, sessionSection: string): boolean {
  const variants = new Set(normalizedSectionVariantsForSql(sessionSection))
  const studentVariants = normalizedSectionVariantsForSql(studentSection)
  return studentVariants.some((v) => variants.has(v))
}

async function upsertStreak(
  studentId: number,
  studentName: string,
  section: string,
  status: AttendanceStatus,
  points: number,
) {
  if (status !== "present" && status !== "late") return

  const todayCT = toZonedTime(new Date(), CENTRAL_TIMEZONE)
  const today = todayCT.toISOString().split("T")[0]
  const streak = await sql`
    SELECT * FROM attendance_streaks WHERE student_id = ${studentId}
  `

  if (streak.length === 0) {
    await sql`
      INSERT INTO attendance_streaks (
        student_id, student_name, section, current_streak, longest_streak, total_points, last_attendance_date
      ) VALUES (
        ${studentId}, ${studentName}, ${section}, 1, 1, ${points}, ${today}
      )
    `
    return
  }

  const streakData = streak[0]
  const lastDate = streakData.last_attendance_date
  const yesterdayCT = toZonedTime(new Date(), CENTRAL_TIMEZONE)
  yesterdayCT.setDate(yesterdayCT.getDate() - 1)
  const yesterdayStr = yesterdayCT.toISOString().split("T")[0]

  let newStreak = 1
  if (lastDate === yesterdayStr) {
    newStreak = streakData.current_streak + 1
  } else if (lastDate !== today) {
    newStreak = 1
  } else {
    newStreak = streakData.current_streak
  }

  const longestStreak = Math.max(newStreak, streakData.longest_streak)
  const bonusPoints = newStreak % 5 === 0 ? 5 : 0

  await sql`
    UPDATE attendance_streaks
    SET current_streak = ${newStreak},
        longest_streak = ${longestStreak},
        total_points = total_points + ${points + bonusPoints},
        last_attendance_date = ${today}
    WHERE student_id = ${studentId}
  `
}

/** POST — instructor marks or updates a student's attendance for a session. */
export async function POST(req: NextRequest) {
  try {
    const instructorAuth = req.headers.get("Authorization")
    const instructorIdHeader = req.headers.get("x-instructor-id")

    if (!instructorAuth || !instructorIdHeader) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const body = await req.json()
    const { sessionId, studentId, studentName, studentNumber } = body
    const rawStatus = body.status != null ? String(body.status).trim().toLowerCase() : "present"
    const status: AttendanceStatus = isAttendanceStatus(rawStatus) ? rawStatus : "present"

    const instructorId = parseInt(String(instructorIdHeader), 10)
    if (!Number.isFinite(instructorId)) {
      return NextResponse.json({ error: "Invalid instructor id" }, { status: 401 })
    }

    const attendanceAuth = await requireInstructorAttendanceAccess(req)
    if (!attendanceAuth.ok) return attendanceAuth.response

    if (body.instructorId != null && String(body.instructorId) !== String(instructorId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (!sessionId || !studentId || !studentName || !studentNumber) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const scoped = await resolveOptionalCourseScope(req)
    if (!scoped.ok) return scoped.response

    const session = await sql`
      SELECT * FROM attendance_sessions
      WHERE id = ${sessionId}
    `

    if (session.length === 0) {
      return NextResponse.json({ error: "Session not found or unauthorized" }, { status: 404 })
    }

    const sessionRow = session[0] as { instructor_id: number; section: string }
    const canAccess = await canActorAccessAttendanceSession(
      instructorId,
      sessionRow,
      scoped.courseId ?? attendanceAuth.courseId,
    )
    if (!canAccess) {
      return NextResponse.json({ error: "Session not found or unauthorized" }, { status: 404 })
    }

    const sessionData = session[0];

    if (sessionData.is_cancelled) {
      return NextResponse.json(
        { error: "This class was cancelled and cannot be marked" },
        { status: 400 },
      );
    }

    const student = await sql`
      SELECT s.id, s.full_name, s.student_id, TRIM(COALESCE(sess.code, s.section::text, '')) AS section
      FROM students s
      LEFT JOIN sessions sess ON s.session_id = sess.id
      WHERE s.id = ${studentId}
    `

    if (student.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const studentData = student[0]
    const studentSection = String(studentData.section ?? "")

    if (!sectionMatches(studentSection, String(sessionData.section ?? ""))) {
      return NextResponse.json(
        { error: "Student is not enrolled in this section" },
        { status: 403 },
      )
    }

    const points = attendancePointsForStatus(status)
    const timestampUTC = new Date()
    const recordSection = studentSection || String(sessionData.section)

    const existing = await sql`
      SELECT id FROM attendance_records
      WHERE student_id = ${studentId} AND session_id = ${sessionId}
      LIMIT 1
    `

    if (existing.length > 0) {
      await sql`
        UPDATE attendance_records
        SET status = ${status},
            points_earned = ${points},
            timestamp = ${timestampUTC.toISOString()}::timestamp,
            check_in_method = 'manual',
            student_name = ${studentName},
            student_number = ${studentNumber},
            section = ${recordSection}
        WHERE id = ${existing[0].id}
      `
    } else {
      await sql`
        INSERT INTO attendance_records (
          student_id, session_id, student_name, student_number, section,
          status, points_earned, timestamp, check_in_method
        ) VALUES (
          ${studentId}, ${sessionId}, ${studentName}, ${studentNumber}, ${recordSection},
          ${status}, ${points}, ${timestampUTC.toISOString()}::timestamp, 'manual'
        )
      `
      await upsertStreak(studentId, studentName, recordSection, status, points)
    }

    await syncGradebookForAttendanceMark(Number(studentId), recordSection)

    return NextResponse.json({
      success: true,
      message: "Attendance recorded",
      status,
      points,
    })
  } catch (error: unknown) {
    console.error("Error in manual override:", error)
    return NextResponse.json({ error: "Failed to mark attendance" }, { status: 500 })
  }
}
