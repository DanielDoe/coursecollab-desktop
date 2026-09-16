import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  buildOfficeHourRequestCourseScopeSqlFragment,
  buildOfficeHourStudentInOfferingSqlFragmentFromRequest,
  ensureOfficeHoursCourseScopeColumns,
  hasOfficeHourRequestsCourseIdColumn,
  studentBelongsToOfficeHourOffering,
} from "@/lib/office-hours-course-scope"
import { createInstructorNotification } from "@/lib/create-instructor-notification"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"

export const dynamic = "force-dynamic"

/** GET - List office hour requests for the instructor's selected course offering */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureOfficeHoursCourseScopeColumns()
    const courseId = scope.course.id
    const hasRequestCourseId = await hasOfficeHourRequestsCourseIdColumn()
    const requestScope = buildOfficeHourRequestCourseScopeSqlFragment("ohr", courseId, hasRequestCourseId)
    const studentScope = buildOfficeHourStudentInOfferingSqlFragmentFromRequest(request, courseId, "s")

    const requests = await sql`
      SELECT ohr.*, s.full_name, s.student_id as student_code, s.email
      FROM office_hour_requests ohr
      JOIN students s ON s.id = ohr.student_id
      WHERE (${requestScope})
        AND (${studentScope})
      ORDER BY
        CASE ohr.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        ohr.created_at DESC
    `
    const withAttachments = await Promise.all(
      (requests as any[]).map(async (r) => {
        try {
          const [att, pref] = await Promise.all([
            sql`SELECT id, file_name, content_type, content FROM office_hour_attachments WHERE request_id = ${r.id}`,
            sql`SELECT preferred_date FROM office_hour_preferred_dates WHERE request_id = ${r.id} ORDER BY preferred_date`,
          ])
          return {
            ...r,
            attachments: att || [],
            preferredDates: (pref || []).map((p: any) => p.preferred_date),
          }
        } catch {
          return { ...r, attachments: [], preferredDates: [] }
        }
      }),
    )
    return NextResponse.json({ requests: withAttachments })
  } catch (error) {
    console.error("[Instructor Office Hours] GET:", error)
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 })
  }
}

/** POST - Create an office hour request on behalf of a course student */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const {
      studentId,
      topic,
      areaOfConcern,
      description,
      priority = "medium",
      preferredDates = [],
      attachments = [],
    } = body

    const internalId = Number(studentId)
    if (!Number.isFinite(internalId) || internalId <= 0) {
      return NextResponse.json({ error: "studentId required" }, { status: 400 })
    }
    if (!topic?.trim()) {
      return NextResponse.json({ error: "topic required" }, { status: 400 })
    }
    const offering = readInstructorSessionScopeFromRequest(request)
    if (
      !(await studentBelongsToOfficeHourOffering({
        studentId: internalId,
        courseId: scope.course.id,
        sessionId: offering.sessionId,
        academicTermId: offering.academicTermId,
      }))
    ) {
      return NextResponse.json({ error: "Student is not in this course offering" }, { status: 403 })
    }

    await ensureOfficeHoursCourseScopeColumns()
    const hasCourseCol = await hasOfficeHourRequestsCourseIdColumn()

    const [inserted] = hasCourseCol
      ? await sql`
          INSERT INTO office_hour_requests (
            student_id, course_id, topic, area_of_concern, description, priority, status
          )
          VALUES (
            ${internalId},
            ${scope.course.id},
            ${String(topic).trim()},
            ${areaOfConcern || null},
            ${description || null},
            ${priority},
            'pending'
          )
          RETURNING *
        `
      : await sql`
          INSERT INTO office_hour_requests (student_id, topic, area_of_concern, description, priority, status)
          VALUES (${internalId}, ${String(topic).trim()}, ${areaOfConcern || null}, ${description || null}, ${priority}, 'pending')
          RETURNING *
        `
    const requestId = (inserted as { id: number }).id

    if (Array.isArray(preferredDates) && preferredDates.length > 0) {
      for (const d of preferredDates) {
        if (d) {
          await sql`
            INSERT INTO office_hour_preferred_dates (request_id, preferred_date)
            VALUES (${requestId}, ${new Date(d)})
          `
        }
      }
    }

    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const a of attachments) {
        await sql`
          INSERT INTO office_hour_attachments (request_id, file_name, content_type, content)
          VALUES (${requestId}, ${a.fileName || null}, ${a.contentType || "code"}, ${a.content || null})
        `
      }
    }

    const student = await sql`SELECT full_name, student_id FROM students WHERE id = ${internalId} LIMIT 1`
    const name = student[0]?.full_name || student[0]?.student_id || "A student"
    try {
      await createInstructorNotification({
        type: "office_hour_request",
        title: `Office Hours Request: ${String(topic).trim()}`,
        message: `${name} requested office hours. Topic: ${String(topic).trim()}`,
        link: "/instructor/office-hours",
        source_type: "office_hour",
        source_id: String(requestId),
      })
    } catch (e) {
      console.warn("[Instructor Office Hours] notification failed:", e)
    }

    return NextResponse.json({ success: true, request: inserted })
  } catch (error) {
    console.error("[Instructor Office Hours] POST:", error)
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 })
  }
}
