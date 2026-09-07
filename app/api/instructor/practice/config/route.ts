import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const session = new URL(request.url).searchParams.get("session") || "ALL"
    const rows = await sql`
      SELECT session, daily_limit, difficulty_distribution, topic_weights, updated_at
      FROM practice_session_configs
      WHERE session = ${session}
      LIMIT 1
    `
    return NextResponse.json({ config: rows[0] ?? null })
  } catch (error) {
    console.error("Error loading practice config:", error)
    return NextResponse.json({ error: "Failed to load practice configuration" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { session, dailyLimit, difficultyDistribution, topicWeights } = await request.json()

    if (!session) {
      return NextResponse.json({ error: "Session is required" }, { status: 400 })
    }

    const limit = Number(dailyLimit)
    if (!Number.isFinite(limit) || limit < 1) {
      return NextResponse.json({ error: "Daily limit must be at least 1" }, { status: 400 })
    }

    const difficultyJson =
      difficultyDistribution != null ? JSON.stringify(difficultyDistribution) : null
    const weightsJson = topicWeights != null ? JSON.stringify(topicWeights) : null

    await sql`
      INSERT INTO practice_session_configs (session, daily_limit, difficulty_distribution, topic_weights, updated_at)
      VALUES (
        ${session},
        ${limit},
        ${difficultyJson}::jsonb,
        ${weightsJson}::jsonb,
        NOW()
      )
      ON CONFLICT (session)
      DO UPDATE SET
        daily_limit = ${limit},
        difficulty_distribution = COALESCE(${difficultyJson}::jsonb, practice_session_configs.difficulty_distribution),
        topic_weights = COALESCE(${weightsJson}::jsonb, practice_session_configs.topic_weights),
        updated_at = NOW()
    `

    return NextResponse.json({
      success: true,
      message: "Practice configuration updated successfully",
    })
  } catch (error) {
    console.error("Error updating practice config:", error)
    return NextResponse.json({ error: "Failed to update practice configuration" }, { status: 500 })
  }
}
