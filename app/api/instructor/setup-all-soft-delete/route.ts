import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const results: any = {}

    // Quizzes
    try {
      await sql`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL`
      await sql`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255) DEFAULT NULL`
      await sql`CREATE INDEX IF NOT EXISTS idx_quizzes_deleted_at ON quizzes(deleted_at)`
      results.quizzes = "✅ Success"
    } catch (e: any) {
      results.quizzes = `Already exists or ${e.message}`
    }

    // Students
    try {
      await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL`
      await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255) DEFAULT NULL`
      await sql`CREATE INDEX IF NOT EXISTS idx_students_deleted_at ON students(deleted_at)`
      results.students = "✅ Success"
    } catch (e: any) {
      results.students = `Already exists or ${e.message}`
    }

    // Sessions
    try {
      await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL`
      await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255) DEFAULT NULL`
      await sql`CREATE INDEX IF NOT EXISTS idx_sessions_deleted_at ON sessions(deleted_at)`
      results.sessions = "✅ Success"
    } catch (e: any) {
      results.sessions = `Already exists or ${e.message}`
    }

    // Groups
    try {
      await sql`ALTER TABLE groups ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL`
      await sql`ALTER TABLE groups ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255) DEFAULT NULL`
      await sql`CREATE INDEX IF NOT EXISTS idx_groups_deleted_at ON groups(deleted_at)`
      results.groups = "✅ Success"
    } catch (e: any) {
      results.groups = `Already exists or ${e.message}`
    }

    // Projects
    try {
      await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL`
      await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255) DEFAULT NULL`
      await sql`CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at)`
      results.projects = "✅ Success"
    } catch (e: any) {
      results.projects = `Already exists or ${e.message}`
    }

    // Lectures
    try {
      await sql`ALTER TABLE lectures ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL`
      await sql`ALTER TABLE lectures ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255) DEFAULT NULL`
      await sql`CREATE INDEX IF NOT EXISTS idx_lectures_deleted_at ON lectures(deleted_at)`
      results.lectures = "✅ Success"
    } catch (e: any) {
      results.lectures = `Already exists or ${e.message}`
    }

    // Lecture Slides
    try {
      await sql`ALTER TABLE lecture_slides ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL`
      await sql`ALTER TABLE lecture_slides ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255) DEFAULT NULL`
      await sql`CREATE INDEX IF NOT EXISTS idx_lecture_slides_deleted_at ON lecture_slides(deleted_at)`
      results.lecture_slides = "✅ Success"
    } catch (e: any) {
      results.lecture_slides = `Already exists or ${e.message}`
    }

    // Announcements
    try {
      await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL`
      await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255) DEFAULT NULL`
      await sql`CREATE INDEX IF NOT EXISTS idx_announcements_deleted_at ON announcements(deleted_at)`
      results.announcements = "✅ Success"
    } catch (e: any) {
      results.announcements = `Already exists or ${e.message}`
    }

    // Deletion History Table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS deletion_history (
          id SERIAL PRIMARY KEY,
          table_name VARCHAR(100) NOT NULL,
          record_id INTEGER NOT NULL,
          record_title VARCHAR(500),
          deleted_by VARCHAR(255),
          deleted_at TIMESTAMP DEFAULT NOW(),
          auto_delete_at TIMESTAMP,
          permanently_deleted BOOLEAN DEFAULT false,
          permanently_deleted_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS idx_deletion_history_auto_delete ON deletion_history(auto_delete_at)`
      results.deletion_history = "✅ Table created"
    } catch (e: any) {
      results.deletion_history = `Already exists or ${e.message}`
    }

    return NextResponse.json({
      success: true,
      message: "✅ Soft delete system set up for all modules! Items will be auto-deleted after 24 hours.",
      details: results
    })
  } catch (error: any) {
    console.error("[Setup All Soft Delete] Failed:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to set up soft delete system",
      details: error.message
    }, { status: 500 })
  }
}
