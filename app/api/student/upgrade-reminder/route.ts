import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    // Check if there's an unread upgrade reminder
    const reminder = await sql`
      SELECT id, is_read, created_at
      FROM notifications 
      WHERE student_id = ${parseInt(studentId)} 
        AND type = 'upgrade_reminder'
        AND is_read = false
      ORDER BY created_at DESC
      LIMIT 1
    `

    return NextResponse.json({
      hasReminder: reminder.length > 0,
      isDismissed: reminder.length === 0,
      reminder: reminder.length > 0 ? reminder[0] : null,
    })
  } catch (error) {
    console.error("[Upgrade Reminder] Failed to check reminder:", error)
    return NextResponse.json({ error: "Failed to check reminder" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { studentId } = await request.json()

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    // Check if student exists
    const studentResult = await sql`
      SELECT id FROM students WHERE id = ${studentId}
    `

    if (studentResult.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // Mark any existing upgrade reminders as read
    await sql`
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE student_id = ${studentId} 
        AND type = 'upgrade_reminder'
        AND is_read = false
    `

    // Create new reminder notification
    const reminder = await sql`
      INSERT INTO notifications (student_id, type, title, message, link, is_read, created_at)
      VALUES (
        ${studentId},
        'upgrade_reminder',
        'Upgrade to Trailblazer',
        'Unlock AI Coding Assistant and other premium features. Upgrade to Trailblazer to get step-by-step guidance during exams!',
        '/student/dashboard-v2/membership',
        false,
        NOW()
      )
      RETURNING *
    `

    return NextResponse.json({ 
      success: true,
      message: "Reminder set successfully",
      reminder: reminder[0]
    })
  } catch (error) {
    console.error("[Upgrade Reminder] Failed to save reminder:", error)
    return NextResponse.json({ error: "Failed to save reminder" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { studentId } = await request.json()

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    // Mark reminder as read (dismissed)
    await sql`
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE student_id = ${studentId} 
        AND type = 'upgrade_reminder'
        AND is_read = false
    `

    return NextResponse.json({ 
      success: true,
      message: "Reminder dismissed successfully" 
    })
  } catch (error) {
    console.error("[Upgrade Reminder] Failed to dismiss reminder:", error)
    return NextResponse.json({ error: "Failed to dismiss reminder" }, { status: 500 })
  }
}
