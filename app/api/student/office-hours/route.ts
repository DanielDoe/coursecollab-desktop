import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  ensureOfficeHoursCourseScopeColumns,
  hasOfficeHourRequestsCourseIdColumn,
  resolveStudentCourseIdForOfficeHours,
} from "@/lib/office-hours-course-scope"
import { createInstructorNotification } from "@/lib/create-instructor-notification"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

/** GET - List office hour requests for the logged-in student */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const claimed = searchParams.get("studentId") || searchParams.get("studentDatabaseId")
    const bound = await requireBoundStudentCaller(request, claimed)
    if (!bound.ok) return bound.response
    const internalId = bound.studentDbId
    const requests = await sql`
      SELECT ohr.*
      FROM office_hour_requests ohr
      WHERE ohr.student_id = ${internalId}
      ORDER BY ohr.created_at DESC
    `
    let withAttachments = requests
    try {
      withAttachments = await Promise.all(
        requests.map(async (r: any) => {
          const [att, pref] = await Promise.all([
            sql`SELECT id, file_name, content_type, content FROM office_hour_attachments WHERE request_id = ${r.id}`,
            sql`SELECT id, preferred_date FROM office_hour_preferred_dates WHERE request_id = ${r.id} ORDER BY preferred_date`,
          ])
          return { ...r, attachments: att || [], preferredDates: (pref || []).map((p: any) => p.preferred_date) }
        })
      )
    } catch {
      withAttachments = requests.map((r: any) => ({ ...r, attachments: [], preferredDates: [] }))
    }
    return NextResponse.json({ requests: withAttachments })
  } catch (error) {
    console.error("[Office Hours] GET:", error)
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 })
  }
}

/** POST - Create a new office hour request */
export async function POST(request: NextRequest) {
  try {
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
    const bound = await requireBoundStudentCaller(request, studentId != null ? String(studentId) : null)
    if (!bound.ok) return bound.response
    if (!topic?.trim()) {
      return NextResponse.json({ error: "topic required" }, { status: 400 })
    }
    const internalId = bound.studentDbId

    await ensureOfficeHoursCourseScopeColumns()
    const hasCourseCol = await hasOfficeHourRequestsCourseIdColumn()
    const studentCourseId = hasCourseCol ? await resolveStudentCourseIdForOfficeHours(internalId) : null

    const [inserted] = hasCourseCol
      ? await sql`
          INSERT INTO office_hour_requests (
            student_id, course_id, topic, area_of_concern, description, priority, status
          )
          VALUES (
            ${internalId},
            ${studentCourseId},
            ${topic.trim()},
            ${areaOfConcern || null},
            ${description || null},
            ${priority},
            'pending'
          )
          RETURNING *
        `
      : await sql`
          INSERT INTO office_hour_requests (student_id, topic, area_of_concern, description, priority, status)
          VALUES (${internalId}, ${topic.trim()}, ${areaOfConcern || null}, ${description || null}, ${priority}, 'pending')
          RETURNING *
        `
    const requestId = (inserted as any).id

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
        title: `Office Hours Request: ${topic.trim()}`,
        message: `${name} requested office hours. Topic: ${topic.trim()}`,
        link: "/instructor/office-hours",
        source_type: "office_hour",
        source_id: String(requestId),
        courseId: studentCourseId,
      })
    } catch (e) {
      console.warn("[Office Hours] Instructor notification failed:", e)
    }

    return NextResponse.json({ success: true, request: inserted })
  } catch (error) {
    console.error("[Office Hours] POST:", error)
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 })
  }
}
