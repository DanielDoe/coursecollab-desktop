import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    // Create topic_availability table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS topic_availability (
        id SERIAL PRIMARY KEY,
        topic TEXT NOT NULL,
        session TEXT NOT NULL,
        is_available BOOLEAN DEFAULT true,
        daily_limit INTEGER DEFAULT 10,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(topic, session)
      )
    `

    // Get all unique topics from question_bank
    const topics = await sql`
      SELECT DISTINCT topic 
      FROM question_bank 
      WHERE topic IS NOT NULL AND topic != ''
      ORDER BY topic
    `

    // Fetch all session codes dynamically from sessions table
    const sessionResults = await sql`
      SELECT code FROM sessions ORDER BY code ASC
    `
    const sessionCodes = sessionResults.map((s: any) => s.code)
    const sessions = ["ALL", ...sessionCodes]

    let insertedCount = 0

    // Insert default availability for all topics and sessions
    for (const topic of topics) {
      for (const session of sessions) {
        try {
          const result = await sql`
            INSERT INTO topic_availability (topic, session, is_available, daily_limit)
            VALUES (${topic.topic}, ${session}, true, 10)
            ON CONFLICT (topic, session) DO UPDATE SET
              is_available = EXCLUDED.is_available,
              daily_limit = EXCLUDED.daily_limit,
              updated_at = NOW()
            RETURNING id
          `
          if (result.length > 0) {
            insertedCount++
          }
        } catch (insertError) {
          console.error(`Error inserting topic ${topic.topic} for session ${session}:`, insertError)
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: "Practice tables initialized successfully",
      topicsCount: topics.length,
      sessionsCount: sessions.length,
      insertedCount: insertedCount
    })
  } catch (error) {
    console.error("Error setting up practice tables:", error)
    return NextResponse.json({ error: "Failed to setup practice tables" }, { status: 500 })
  }
}