import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    // Create the instructor_practice_notifications table
    await sql`
      CREATE TABLE IF NOT EXISTS instructor_practice_notifications (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL,
        student_name VARCHAR(255) NOT NULL,
        notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('performance', 'milestone', 'struggle')),
        message TEXT NOT NULL,
        data JSONB DEFAULT '{}'::jsonb,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_instructor_practice_notif_student ON instructor_practice_notifications(student_id)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_instructor_practice_notif_type ON instructor_practice_notifications(notification_type)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_instructor_practice_notif_read ON instructor_practice_notifications(is_read)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_instructor_practice_notif_created ON instructor_practice_notifications(created_at DESC)
    `

    return NextResponse.json({
      success: true,
      message: "Instructor practice notifications table created successfully"
    })
  } catch (error) {
    console.error("[Setup] Failed to create instructor practice notifications table:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to create table",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
