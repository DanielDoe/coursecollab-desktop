import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    // Verify instructor authentication
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    
    if (!instructorSession) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "20")
    const type = searchParams.get("type") // 'performance', 'milestone', 'struggle', 'all'

    // Build where clause based on type
    let typeFilter = ""
    if (type && type !== "all") {
      typeFilter = `AND notification_type = '${type}'`
    }

    // Fetch recent practice activities that instructors should know about
    const notifications = await sql`
      SELECT 
        id,
        student_id,
        student_name,
        notification_type,
        message,
        data,
        created_at,
        is_read
      FROM instructor_practice_notifications
      WHERE 1=1 ${sql.raw(typeFilter)}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `

    // Get summary stats
    const summary = await sql`
      SELECT 
        COUNT(*)::INTEGER as total_notifications,
        COUNT(CASE WHEN is_read = false THEN 1 END)::INTEGER as unread_count,
        COUNT(CASE WHEN notification_type = 'performance' THEN 1 END)::INTEGER as performance_count,
        COUNT(CASE WHEN notification_type = 'milestone' THEN 1 END)::INTEGER as milestone_count,
        COUNT(CASE WHEN notification_type = 'struggle' THEN 1 END)::INTEGER as struggle_count
      FROM instructor_practice_notifications
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `

    return NextResponse.json({
      notifications,
      summary: summary[0] || {
        total_notifications: 0,
        unread_count: 0,
        performance_count: 0,
        milestone_count: 0,
        struggle_count: 0
      }
    })
  } catch (error) {
    console.error("[Instructor Practice Notifications] Failed to fetch:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify instructor authentication
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    
    if (!instructorSession) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const { notificationIds } = await request.json()

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return NextResponse.json({ error: "Invalid notification IDs" }, { status: 400 })
    }

    // Mark notifications as read
    await sql`
      UPDATE instructor_practice_notifications
      SET is_read = true
      WHERE id = ANY(${notificationIds})
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Instructor Practice Notifications] Failed to mark as read:", error)
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 })
  }
}
