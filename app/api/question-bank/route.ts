import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const topic = searchParams.get("topic")

    let questions
    if (topic && topic !== "all") {
      questions = await sql`
        SELECT 
          id,
          question_text,
          question_type,
          difficulty,
          topic,
          created_at
        FROM question_bank
        WHERE topic = ${topic}
        ORDER BY created_at DESC
      `
    } else {
      questions = await sql`
        SELECT 
          id,
          question_text,
          question_type,
          difficulty,
          topic,
          created_at
        FROM question_bank
        ORDER BY created_at DESC
      `
    }

    return NextResponse.json({ questions })
  } catch (error: any) {
    console.error("[v0] Failed to fetch question bank:", error)
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 })
  }
}

