import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireBoundStudentCaller, requireCallerStudentDbId } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

function claimedStudentId(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text ? text : null
}

// GET - Fetch calendar events for the authenticated student
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const studentId = searchParams.get("studentId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const auth = await requireBoundStudentCaller(request, studentId)
    if (!auth.ok) return auth.response

    let events
    if (startDate && endDate) {
      events = await sql`
        SELECT 
          id,
          title,
          description,
          event_type,
          start_time,
          end_time,
          all_day,
          location,
          color,
          is_completed,
          reminder_minutes,
          related_id,
          related_type,
          created_at
        FROM calendar_events
        WHERE student_id = ${auth.studentDbId}
          AND start_time BETWEEN ${startDate} AND ${endDate}
        ORDER BY start_time ASC
      `
    } else {
      events = await sql`
        SELECT 
          id,
          title,
          description,
          event_type,
          start_time,
          end_time,
          all_day,
          location,
          color,
          is_completed,
          reminder_minutes,
          related_id,
          related_type,
          created_at
        FROM calendar_events
        WHERE student_id = ${auth.studentDbId}
        ORDER BY start_time ASC
      `
    }

    return NextResponse.json({
      success: true,
      events
    })
  } catch (error: any) {
    console.error("[Calendar Events GET Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch events" },
      { status: 500 }
    )
  }
}

// POST - Create new calendar event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      studentId,
      title,
      description,
      event_type,
      start_time,
      end_time,
      all_day = false,
      location,
      color = '#3b82f6',
      reminder_minutes = 30,
      announcement_id: announcementIdRaw,
    } = body

    const auth = await requireBoundStudentCaller(request, claimedStudentId(studentId))
    if (!auth.ok) return auth.response

    const announcementId =
      announcementIdRaw != null && Number.isFinite(Number(announcementIdRaw))
        ? Number(announcementIdRaw)
        : null

    if (announcementId != null) {
      const existing = await sql`
        SELECT *
        FROM calendar_events
        WHERE student_id = ${auth.studentDbId}
          AND related_type = 'announcement'
          AND related_id = ${announcementId}
        LIMIT 1
      `
      if (existing.length > 0) {
        return NextResponse.json({ success: true, event: existing[0] })
      }

      const announcementRows = await sql`
        SELECT id, course_id, title
        FROM announcements
        WHERE id = ${announcementId}
        LIMIT 1
      `
      if (announcementRows.length === 0) {
        return NextResponse.json({ success: false, error: "Announcement not found" }, { status: 404 })
      }
      const courseId = announcementRows[0].course_id
      if (courseId != null) {
        const enrolled = await sql`
          SELECT 1 FROM students
          WHERE id = ${auth.studentDbId}
            AND course_id = ${courseId}
            AND deleted_at IS NULL
          LIMIT 1
        `
        if (enrolled.length === 0) {
          return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
        }
      }
    }

    if (!title || !event_type || !start_time) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: title, event_type, start_time" },
        { status: 400 }
      )
    }

    const result = await sql`
      INSERT INTO calendar_events (
        student_id,
        title,
        description,
        event_type,
        start_time,
        end_time,
        all_day,
        location,
        color,
        reminder_minutes,
        related_type,
        related_id
      ) VALUES (
        ${auth.studentDbId},
        ${title},
        ${description || null},
        ${event_type},
        ${start_time},
        ${end_time || null},
        ${all_day},
        ${location || null},
        ${color},
        ${reminder_minutes},
        ${announcementId != null ? "announcement" : null},
        ${announcementId}
      )
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      event: result[0]
    })
  } catch (error: any) {
    console.error("[Calendar Events POST Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to create event" },
      { status: 500 }
    )
  }
}

// PUT - Update calendar event
export async function PUT(request: NextRequest) {
  try {
    const caller = await requireCallerStudentDbId(request)
    if (!caller.ok) return caller.response

    const {
      eventId,
      title,
      description,
      startTime,
      endTime,
      isCompleted,
      color
    } = await request.json()

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: "eventId is required" },
        { status: 400 }
      )
    }

    const existing = await sql`
      SELECT student_id FROM calendar_events WHERE id = ${eventId} LIMIT 1
    `
    if (!existing.length || Number(existing[0].student_id) !== caller.studentDbId) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      )
    }

    // Build update query based on provided fields
    let result
    
    if (isCompleted !== undefined && title === undefined) {
      // Simple completion toggle
      result = await sql`
        UPDATE calendar_events
        SET 
          is_completed = ${isCompleted},
          updated_at = NOW()
        WHERE id = ${eventId}
          AND student_id = ${caller.studentDbId}
        RETURNING *
      `
    } else {
      // Full update
      result = await sql`
        UPDATE calendar_events
        SET 
          title = COALESCE(${title}, title),
          description = COALESCE(${description}, description),
          start_time = COALESCE(${startTime}, start_time),
          end_time = COALESCE(${endTime}, end_time),
          is_completed = COALESCE(${isCompleted}, is_completed),
          color = COALESCE(${color}, color),
          updated_at = NOW()
        WHERE id = ${eventId}
          AND student_id = ${caller.studentDbId}
        RETURNING *
      `
    }

    if (!result.length) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      event: result[0]
    })
  } catch (error: any) {
    console.error("[Calendar Events PUT Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to update event" },
      { status: 500 }
    )
  }
}

// DELETE - Delete calendar event
export async function DELETE(request: NextRequest) {
  try {
    const caller = await requireCallerStudentDbId(request)
    if (!caller.ok) return caller.response

    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get("eventId")

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: "eventId is required" },
        { status: 400 }
      )
    }

    const existing = await sql`
      SELECT student_id FROM calendar_events WHERE id = ${eventId} LIMIT 1
    `
    if (!existing.length || Number(existing[0].student_id) !== caller.studentDbId) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      )
    }

    await sql`
      DELETE FROM calendar_events
      WHERE id = ${eventId}
        AND student_id = ${caller.studentDbId}
    `

    return NextResponse.json({
      success: true,
      message: "Event deleted successfully"
    })
  } catch (error: any) {
    console.error("[Calendar Events DELETE Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete event" },
      { status: 500 }
    )
  }
}
