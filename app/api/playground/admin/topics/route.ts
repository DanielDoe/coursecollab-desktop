import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorSession } from "@/lib/instructor-session-auth"

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    // Fetch all unique topics from question bank with question counts
    const topics = await sql`
      SELECT 
        topic,
        COUNT(*) as question_count
      FROM question_bank
      WHERE topic IS NOT NULL AND topic != ''
      GROUP BY topic
      ORDER BY topic ASC
    `

    return NextResponse.json({
      topics: topics.map((t) => ({
        name: t.topic,
        questionCount: Number(t.question_count),
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch topics" }, { status: 500 })
  }
}
