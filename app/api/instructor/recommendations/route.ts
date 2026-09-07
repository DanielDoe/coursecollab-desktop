import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import {
  ensureInstructorRecommendationSettings,
  getActiveSemesterKey,
  logRecommendationAudit,
  RECOMMENDATION_PURPOSES,
} from "@/lib/recommendation-letters"
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope"
import { requireInstructorCourse, studentBelongsToCourse } from "@/lib/instructor-course-scope"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { notifyRecommendationInstructor } from "@/lib/recommendation-instructor-email"
import { notifyRecommendationStudent } from "@/lib/recommendation-student-email"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response
    const id = session.instructorId

    const scoped = await resolveOptionalCourseScope(request)
    if (!scoped.ok) return scoped.response
    if (scoped.courseId != null && String(scoped.instructorId ?? "") !== String(id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get("status")

    await ensureInstructorRecommendationSettings(id)

    // Recommendation letters are instructor-scoped, not filtered by the dashboard course switcher.
    const rows = sqlRows(
      statusFilter
        ? await sql`
        SELECT r.*,
          s.full_name AS student_name,
          s.student_id AS student_external_id,
          sess.code AS course_code,
          (SELECT pdf_url FROM recommendation_files f WHERE f.request_id = r.id ORDER BY f.id DESC LIMIT 1) AS latest_pdf_url,
          (SELECT downloaded_at FROM recommendation_files f WHERE f.request_id = r.id ORDER BY f.id DESC LIMIT 1) AS latest_download_at
        FROM recommendation_requests r
        JOIN students s ON s.id = r.student_id
        JOIN sessions sess ON sess.id = r.course_id
        WHERE r.instructor_id = ${id} AND r.status = ${statusFilter}
        ORDER BY r.created_at DESC
      `
        : await sql`
        SELECT r.*,
          s.full_name AS student_name,
          s.student_id AS student_external_id,
          sess.code AS course_code,
          (SELECT pdf_url FROM recommendation_files f WHERE f.request_id = r.id ORDER BY f.id DESC LIMIT 1) AS latest_pdf_url,
          (SELECT downloaded_at FROM recommendation_files f WHERE f.request_id = r.id ORDER BY f.id DESC LIMIT 1) AS latest_download_at
        FROM recommendation_requests r
        JOIN students s ON s.id = r.student_id
        JOIN sessions sess ON sess.id = r.course_id
        WHERE r.instructor_id = ${id}
        ORDER BY r.created_at DESC
      `,
    )

    return NextResponse.json({ requests: rows })
  } catch (e) {
    console.error("[instructor rec list]", e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

function parsePurpose(v: string): string | null {
  const p = v.trim().toLowerCase().replace(/[\s-]+/g, "_")
  return (RECOMMENDATION_PURPOSES as readonly string[]).includes(p) ? p : null
}

/** POST - Create a recommendation request on behalf of a course student */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const studentId = Number(body.studentId ?? body.studentDatabaseId)
    if (!Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ error: "studentId required" }, { status: 400 })
    }
    if (!(await studentBelongsToCourse(studentId, scope.course.id))) {
      return NextResponse.json({ error: "Student is not in this course" }, { status: 403 })
    }

    const courseId = Number(body.courseId ?? body.course_id)
    const instructorId = Number(body.instructorId ?? body.instructor_id ?? scope.instructorId)
    const purpose = parsePurpose(String(body.purpose ?? ""))
    if (!purpose) return NextResponse.json({ error: "Invalid purpose" }, { status: 400 })
    if (!Number.isFinite(courseId) || !Number.isFinite(instructorId)) {
      return NextResponse.json({ error: "course and instructor required" }, { status: 400 })
    }
    if (instructorId !== scope.instructorId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const sessionRows = await sql`
      SELECT id FROM sessions WHERE id = ${courseId} AND course_id = ${scope.course.id} LIMIT 1
    `
    if (sessionRows.length === 0) {
      return NextResponse.json({ error: "Session is not in this course" }, { status: 403 })
    }

    const deadlineStr = body.deadline ? String(body.deadline) : null
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
    const settings = settingsRows[0] as {
      enabled: boolean
      max_requests_per_semester: number
      minimum_notice_days: number
      require_purpose_deadline: boolean
    } | undefined
    if (!settings?.enabled) {
      return NextResponse.json(
        { error: "This instructor is not accepting recommendation requests right now." },
        { status: 403 },
      )
    }
    if (settings.require_purpose_deadline && !deadlineStr) {
      return NextResponse.json({ error: "Deadline is required" }, { status: 400 })
    }

    let deadline: string | null = null
    if (deadlineStr) {
      const d = new Date(deadlineStr)
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid deadline" }, { status: 400 })
      }
      deadline = d.toISOString().slice(0, 10)
    }

    const semesterKey = (await getActiveSemesterKey()) ?? "unknown"
    let purposeOtherDetail: string | null = null
    if (purpose === "other") {
      const detail = String(body.purposeOtherDetail ?? body.purpose_other_detail ?? "")
        .trim()
        .slice(0, 500)
      if (detail.length < 2) {
        return NextResponse.json(
          { error: 'When purpose is "Other", add a short phrase (2+ characters).' },
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
        ${studentId}, ${instructorId}, ${courseId}, ${purpose}, ${purposeOtherDetail},
        ${body.recipientName != null ? String(body.recipientName) : null},
        ${body.recipientOrganization != null ? String(body.recipientOrganization) : null},
        null,
        ${deadline}, ${Boolean(body.letterIsSpecific ?? body.letter_is_specific)},
        'requested', ${semesterKey}, ${studentRequestDescription}
      )
      RETURNING id
    `,
    )
    const requestId = Number(ins[0].id)
    await logRecommendationAudit({
      requestId,
      actorType: "instructor",
      actorId: instructorId,
      action: "request_created_on_behalf",
      details: { purpose, courseId, studentId },
    })

    try {
      await notifyRecommendationStudent(requestId, "created")
    } catch (emailErr) {
      console.error("[instructor rec create] student email:", emailErr)
    }
    try {
      await notifyRecommendationInstructor(requestId, "new_request")
    } catch (emailErr) {
      console.error("[instructor rec create] instructor email:", emailErr)
    }

    return NextResponse.json({ id: requestId })
  } catch (e) {
    console.error("[instructor rec create]", e)
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 })
  }
}
