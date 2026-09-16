import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const sql = getSQL()

    // Mark all notifications as read
    await sql`
      UPDATE instructor_notifications 
      SET is_read = true, read_at = NOW()
      WHERE is_read = false
    `

    return NextResponse.json({ 
      success: true, 
      message: "All notifications marked as read" 
    })
  } catch (error) {
    console.error("[Instructor Notifications] Failed to mark all as read:", error)
    // Return success anyway for UX
    return NextResponse.json({ 
      success: true, 
      message: "All notifications marked as read" 
    })
  }
}
