import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

    console.log("🚀 Creating attempt_overrides table...")

    await sql`
      CREATE TABLE IF NOT EXISTS attempt_overrides (
        id SERIAL PRIMARY KEY,
        quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        additional_attempts INTEGER NOT NULL DEFAULT 1 CHECK (additional_attempts > 0),
        reason TEXT,
        granted_by INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(quiz_id, student_id)
      )
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_attempt_overrides_quiz_student ON attempt_overrides(quiz_id, student_id)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_attempt_overrides_student ON attempt_overrides(student_id)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_attempt_overrides_active ON attempt_overrides(is_active, expires_at)
    `

    console.log("✅ attempt_overrides table created successfully!")
    return NextResponse.json({ success: true, message: "Successfully created attempt_overrides table" })
  } catch (error: any) {
    console.error("❌ Error creating attempt_overrides table:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

