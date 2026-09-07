import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: Request) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { table, id, correct_answer } = await request.json()

    console.log("[v0] Updating select_all question:", { table, id, correct_answer })

    if (table === "quiz_questions") {
      await sql`
        UPDATE quiz_questions 
        SET correct_answer = ${correct_answer}
        WHERE id = ${id} AND question_type = 'select_all'
      `
    } else if (table === "question_bank") {
      await sql`
        UPDATE question_bank 
        SET correct_answer = ${correct_answer}
        WHERE id = ${id} AND question_type = 'select_all'
      `
    } else {
      return NextResponse.json({ error: "Invalid table name" }, { status: 400 })
    }

    console.log("[v0] ✅ Successfully updated question")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to update select_all question:", error)
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 })
  }
}
