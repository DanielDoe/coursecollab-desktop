import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    const limit = request.nextUrl.searchParams.get("limit") || "20"

    if (!adminId) {
      return NextResponse.json({ error: "Admin ID required" }, { status: 400 })
    }

    // Fetch notifications
    const notifications = await sql`
      SELECT 
        id,
        type,
        title,
        message,
        link,
        is_read,
        created_at,
        read_at
      FROM admin_notifications
      WHERE admin_id = ${adminId}
      ORDER BY created_at DESC
      LIMIT ${Number.parseInt(limit)}
    `

    // Count unread
    const unreadResult = await sql`
      SELECT COUNT(*) as count
      FROM admin_notifications
      WHERE admin_id = ${adminId} AND is_read = false
    `

    return NextResponse.json({
      notifications,
      unread_count: Number.parseInt(unreadResult[0].count),
    })
  } catch (error: any) {
    // Handle table not existing gracefully
    if (error.code === "42P01") {
      return NextResponse.json({
        notifications: [],
        unread_count: 0,
      })
    }

    console.error("[v0] Failed to fetch admin notifications:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    const body = await request.json()

    if (!adminId) {
      return NextResponse.json({ error: "Admin ID required" }, { status: 400 })
    }

    if (body.mark_all_read) {
      // Mark all as read
      await sql`
        UPDATE admin_notifications
        SET is_read = true, read_at = NOW()
        WHERE admin_id = ${adminId} AND is_read = false
      `
    } else if (body.notification_id) {
      // Mark single notification as read
      await sql`
        UPDATE admin_notifications
        SET is_read = true, read_at = NOW()
        WHERE id = ${body.notification_id} AND admin_id = ${adminId}
      `
    } else {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    // Handle table not existing gracefully
    if (error.code === "42P01") {
      return NextResponse.json({ success: true })
    }

    console.error("[v0] Failed to update admin notifications:", error)
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 })
  }
}
