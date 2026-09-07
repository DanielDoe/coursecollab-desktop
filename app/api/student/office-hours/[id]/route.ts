import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

/** PATCH - Update an office hour request (student only, pending only) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const requestId = parseInt(id, 10)
    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    const body = await request.json()
    const { studentId, topic, areaOfConcern, description, priority, preferredDates, attachments = [], status } = body
    const bound = await requireBoundStudentCaller(request, studentId != null ? String(studentId) : null)
    if (!bound.ok) return bound.response
    const internalId = bound.studentDbId

    const [existing] = await sql`
      SELECT * FROM office_hour_requests WHERE id = ${requestId}
    `
    if (!existing || (existing as any).student_id !== internalId) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }
    if ((existing as any).status !== "pending") {
      return NextResponse.json({ error: "Can only update pending requests" }, { status: 400 })
    }

    if (String(status ?? "").trim().toLowerCase() === "cancelled") {
      await sql`
        ALTER TABLE office_hour_requests
        ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ
      `.catch(() => undefined)
      await sql`
        UPDATE office_hour_requests SET
          status = 'cancelled',
          cancelled_at = NOW(),
          updated_at = NOW()
        WHERE id = ${requestId}
          AND student_id = ${internalId}
          AND status = 'pending'
      `
      const [cancelled] = await sql`SELECT * FROM office_hour_requests WHERE id = ${requestId}`
      return NextResponse.json({ success: true, request: cancelled })
    }

    const curr = existing as any
    const newTopic = topic !== undefined ? String(topic).trim() : curr.topic
    const newArea = areaOfConcern !== undefined ? (areaOfConcern || null) : curr.area_of_concern
    const newDesc = description !== undefined ? (description || null) : curr.description
    const newPriority = priority !== undefined ? priority : curr.priority

    await sql`
      UPDATE office_hour_requests SET
        topic = ${newTopic},
        area_of_concern = ${newArea},
        description = ${newDesc},
        priority = ${newPriority},
        updated_at = NOW()
      WHERE id = ${requestId}
    `

    if (Array.isArray(preferredDates)) {
      await sql`DELETE FROM office_hour_preferred_dates WHERE request_id = ${requestId}`
      for (const d of preferredDates) {
        if (d) {
          await sql`
            INSERT INTO office_hour_preferred_dates (request_id, preferred_date)
            VALUES (${requestId}, ${new Date(d)})
          `
        }
      }
    }

    if (Array.isArray(attachments)) {
      await sql`DELETE FROM office_hour_attachments WHERE request_id = ${requestId}`
      for (const a of attachments) {
        if (a?.content) {
          await sql`
            INSERT INTO office_hour_attachments (request_id, file_name, content_type, content)
            VALUES (${requestId}, ${a.fileName || null}, ${a.contentType || "code"}, ${a.content})
          `
        }
      }
    }

    const [updated] = await sql`SELECT * FROM office_hour_requests WHERE id = ${requestId}`
    return NextResponse.json({ success: true, request: updated })
  } catch (error) {
    console.error("[Office Hours] PATCH:", error)
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 })
  }
}

/** DELETE - Cancel/delete an office hour request (student only) */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const requestId = parseInt(id, 10)
    if (isNaN(requestId)) {
      return NextResponse.json({ error: "Invalid request ID" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const claimed = searchParams.get("studentId") || searchParams.get("studentDatabaseId")
    const bound = await requireBoundStudentCaller(request, claimed)
    if (!bound.ok) return bound.response
    const internalId = bound.studentDbId

    const [existing] = await sql`
      SELECT id, student_id, status FROM office_hour_requests WHERE id = ${requestId}
    `
    if (!existing || (existing as any).student_id !== internalId) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    await sql`DELETE FROM office_hour_requests WHERE id = ${requestId}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Office Hours] DELETE:", error)
    return NextResponse.json({ error: "Failed to delete request" }, { status: 500 })
  }
}
