import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    // Get all topics from question bank
    const allTopics = await sql`
      SELECT 
        id,
        topic,
        question_type,
        difficulty,
        created_at
      FROM question_bank 
      WHERE topic IS NOT NULL AND topic != ''
      ORDER BY topic
    `

    // Get unique topics with counts
    const uniqueTopics = await sql`
      SELECT 
        topic,
        COUNT(*) as question_count,
        COUNT(DISTINCT question_type) as question_types,
        STRING_AGG(DISTINCT question_type, ', ') as types_list
      FROM question_bank 
      WHERE topic IS NOT NULL AND topic != ''
      GROUP BY topic
      ORDER BY topic
    `

    // Get topic availability status
    const availability = await sql`
      SELECT 
        topic,
        session,
        is_available,
        daily_limit,
        updated_at
      FROM topic_availability
      ORDER BY topic, session
    `

    return NextResponse.json({
      totalQuestions: allTopics.length,
      uniqueTopics: uniqueTopics.length,
      topics: uniqueTopics,
      allTopics: allTopics.slice(0, 10), // First 10 for debugging
      availability: availability,
      sampleTopics: uniqueTopics.slice(0, 5)
    })
  } catch (error) {
    console.error("Error debugging question bank topics:", error)
    return NextResponse.json({ error: "Failed to debug topics", details: error.message }, { status: 500 })
  }
}
