import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    // Create instructor_notifications table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS instructor_notifications (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        link TEXT,
        source_type TEXT,
        source_id TEXT,
        instructor_id INTEGER,
        course_id INTEGER,
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `

    // Insert some sample notifications if table is empty
    const existingCount = await sql`
      SELECT COUNT(*) as count FROM instructor_notifications
    `

    if (existingCount[0].count === 0) {
      await sql`
        INSERT INTO instructor_notifications (type, title, message, link, source_type, source_id, is_read, created_at) VALUES
        ('quiz_submission', 'New Quiz Submissions', '15 students have submitted Quiz 3', '/instructor/results', 'quiz', '3', false, NOW() - INTERVAL '1 hour'),
        ('student_question', 'Student Question on Lecture 5', 'John Doe asked a question about pointers', '/instructor/lectures', 'lecture', '5', false, NOW() - INTERVAL '2 hours'),
        ('low_completion', 'Low Assignment Completion', 'Only 60% of students completed Homework 2', '/instructor/homework', 'homework', '2', false, NOW() - INTERVAL '3 hours'),
        ('deadline_reminder', 'Upcoming Deadline', 'Mid-semester exam is due in 2 days', '/instructor/mid-semester-exams', 'exam', '1', true, NOW() - INTERVAL '4 hours'),
        ('analytics', 'Weekly Analytics Ready', 'Your weekly performance report is available', '/instructor/analytics', 'system', null, true, NOW() - INTERVAL '1 day')
      `
    }

    return NextResponse.json({ 
      success: true, 
      message: "Instructor notifications table initialized successfully" 
    })
  } catch (error) {
    console.error("Error setting up instructor notifications:", error)
    return NextResponse.json({ error: "Failed to setup instructor notifications" }, { status: 500 })
  }
}
