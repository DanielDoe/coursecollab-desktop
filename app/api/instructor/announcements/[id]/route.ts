import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sql = getSQL()
    const announcementId = params.id

    const announcements = await sql`
      SELECT 
        a.*,
        COUNT(DISTINCT ar.student_id) as read_count
      FROM announcements a
      LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id
      WHERE a.id = ${announcementId}
      GROUP BY a.id
    `

    if (announcements.length === 0) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    // Get students who have read the announcement
    const readers = await sql`
      SELECT 
        s.id,
        s.full_name,
        s.section,
        ar.read_at
      FROM announcement_reads ar
      JOIN students s ON ar.student_id = s.id
      WHERE ar.announcement_id = ${announcementId}
      ORDER BY ar.read_at DESC
    `

    return NextResponse.json({
      announcement: announcements[0],
      readers
    })
  } catch (error) {
    console.error("[Instructor Announcements] Failed to fetch announcement:", error)
    return NextResponse.json({ error: "Failed to fetch announcement" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { title, content, type, priority, target_session, expires_at, is_active } = await request.json()
    const sql = getSQL()
    const announcementId = params.id

    // Check if announcement exists
    const existing = await sql`
      SELECT id FROM announcements WHERE id = ${announcementId}
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    // Update announcement
    const result = await sql`
      UPDATE announcements 
      SET 
        title = COALESCE(${title || null}, title),
        content = COALESCE(${content || null}, content),
        type = COALESCE(${type || null}, type),
        priority = COALESCE(${priority || null}, priority),
        target_session = COALESCE(${target_session || null}, target_session),
        expires_at = ${expires_at !== undefined ? expires_at : null},
        is_active = COALESCE(${is_active !== undefined ? is_active : null}, is_active),
        updated_at = NOW()
      WHERE id = ${announcementId}
      RETURNING *
    `

    return NextResponse.json({
      announcement: result[0],
      message: "Announcement updated successfully"
    })
  } catch (error) {
    console.error("[Instructor Announcements] Failed to update:", error)
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sql = getSQL()
    const announcementId = params.id

    // Check if announcement exists
    const existing = await sql`
      SELECT id, title FROM announcements WHERE id = ${announcementId}
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    // Delete related records first
    await sql`DELETE FROM announcement_reads WHERE announcement_id = ${announcementId}`
    
    // Delete the announcement
    await sql`DELETE FROM announcements WHERE id = ${announcementId}`

    return NextResponse.json({
      message: "Announcement deleted successfully",
      announcement: existing[0]
    })
  } catch (error) {
    console.error("[Instructor Announcements] Failed to delete:", error)
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 })
  }
}
