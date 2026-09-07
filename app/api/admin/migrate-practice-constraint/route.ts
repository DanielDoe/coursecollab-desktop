import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    console.log("[Migration] Adding unique constraint to practice_answers...")

    // Check if constraint already exists
    const constraintCheck = await sql`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'practice_answers' 
        AND constraint_name = 'unique_practice_attempt_question'
    `

    if (constraintCheck.length === 0) {
      // Add unique constraint
      await sql`
        ALTER TABLE practice_answers
        ADD CONSTRAINT unique_practice_attempt_question UNIQUE (attempt_id, bank_question_id)
      `
      console.log("[Migration] Added unique constraint")
    } else {
      console.log("[Migration] Constraint already exists")
    }

    // Add index
    await sql`
      CREATE INDEX IF NOT EXISTS idx_practice_answers_attempt_question ON practice_answers(attempt_id, bank_question_id)
    `

    console.log("[Migration] Successfully completed migration")

    return NextResponse.json({ 
      success: true,
      message: "Successfully added unique constraint to practice_answers table"
    })
  } catch (error) {
    console.error("[Migration] Failed:", error)
    return NextResponse.json({ 
      error: "Migration failed",
      details: error.message
    }, { status: 500 })
  }
}

