import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const topic = searchParams.get("topic")

    if (!topic) {
      return NextResponse.json({ error: "Topic parameter required" }, { status: 400 })
    }

    console.log(`[Verification History] Fetching history for topic: ${topic}`)

    const history = await sql`
      SELECT 
        id,
        question_id,
        topic,
        question_type,
        old_answer,
        new_answer,
        ai_reasoning,
        ai_confidence,
        verified_by,
        verified_by_id,
        status,
        created_at,
        updated_at
      FROM ai_verification_history
      WHERE topic = ${topic}
      ORDER BY created_at DESC
      LIMIT 100
    `

    console.log(`[Verification History] Found ${history.length} records`)

    return NextResponse.json({
      success: true,
      history: history
    })

  } catch (error) {
    console.error("[Verification History] Error:", error)
    return NextResponse.json(
      { 
        error: "Failed to fetch verification history",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

