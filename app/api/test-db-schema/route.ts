import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    // Check if question_bank table exists and get its structure
    const tableInfo = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'question_bank'
      ORDER BY ordinal_position
    `

    // Get a sample question
    const sampleQuestion = await sql`
      SELECT * FROM question_bank LIMIT 1
    `

    // Check practice_attempts table structure
    const practiceAttemptsInfo = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'practice_attempts'
      ORDER BY ordinal_position
    `

    // Check practice_answers table structure
    const practiceAnswersInfo = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'practice_answers'
      ORDER BY ordinal_position
    `

    return NextResponse.json({ 
      tableInfo,
      sampleQuestion: sampleQuestion[0] || null,
      practiceAttemptsInfo,
      practiceAnswersInfo
    })
  } catch (error) {
    console.error("Failed to check database schema:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
