import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveSessionRowByCode } from "@/lib/resolve-session-by-code"

// Mark as dynamic to prevent build-time database initialization
export const dynamic = 'force-dynamic'

// GET - Fetch all topics with availability status per session
export async function GET() {
  try {
    const topics = await sql`
      SELECT 
        qb.topic as name,
        COUNT(DISTINCT qb.id) as question_count,
        json_object_agg(
          pta.session,
          json_build_object(
            'is_available', COALESCE(pta.is_available, true),
            'daily_limit', COALESCE(pta.daily_limit, 10),
            'updated_at', pta.updated_at
          )
        ) FILTER (WHERE pta.session IS NOT NULL) as availability
      FROM question_bank qb
      LEFT JOIN practice_topic_availability pta ON qb.topic = pta.topic_name
      WHERE qb.topic IS NOT NULL
      GROUP BY qb.topic
      ORDER BY qb.topic ASC
    `
    // </CHANGE>

    return NextResponse.json({ topics })
  } catch (error) {
    console.error("[v0] Error fetching admin topics:", error)
    return NextResponse.json({ error: "Failed to fetch topics" }, { status: 500 })
  }
}

// PATCH - Update topic availability for a session
export async function PATCH(request: NextRequest) {
  try {
    const { topic, session, isAvailable, dailyLimit } = await request.json()
    const adminId = request.headers.get("x-admin-id")

    if (!topic || !session) {
      return NextResponse.json({ error: "Topic and session are required" }, { status: 400 })
    }

    let sessionKey = session
    if (session !== "ALL") {
      const resolved = await resolveSessionRowByCode(String(session))
      if (!resolved) {
        return NextResponse.json({ error: "Invalid session" }, { status: 400 })
      }
      sessionKey = resolved.code
    }

    await sql`
      INSERT INTO practice_topic_availability (topic_name, session, is_available, daily_limit, updated_by, updated_at)
      VALUES (
        ${topic}, 
        ${sessionKey}, 
        ${isAvailable !== undefined ? isAvailable : true}, 
        ${dailyLimit !== undefined ? dailyLimit : 10}, 
        ${adminId ? Number.parseInt(adminId) : null}, 
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (topic_name, session) 
      DO UPDATE SET 
        is_available = EXCLUDED.is_available,
        daily_limit = EXCLUDED.daily_limit,
        updated_by = EXCLUDED.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `
    // </CHANGE>

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error updating topic availability:", error)
    return NextResponse.json({ error: "Failed to update topic availability" }, { status: 500 })
  }
}
