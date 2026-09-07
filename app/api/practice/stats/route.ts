import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStudentPracticeCaller } from "@/lib/require-student-practice-auth"

export const dynamic = "force-dynamic"
export const revalidate = 10 // Cache for 10 seconds
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const perfStart = Date.now()
  
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    const auth = await requireStudentPracticeCaller(request, studentId)
    if (!auth.ok) return auth.response

    // Get overall stats
    const statsResult = await sql`
      SELECT 
        COUNT(*) as total_attempts,
        AVG(score_percentage) as avg_score
      FROM practice_attempts
      WHERE student_id = ${auth.studentDbId}
        AND completed_at IS NOT NULL
    `

    // Get weak topics
    const weakTopics = await sql`
      SELECT * FROM get_weak_topics(${auth.studentDbId}, 3)
    `

    console.log(`[Perf] /api/practice/stats completed in ${Date.now() - perfStart}ms for student ${auth.studentDbId}`)
    
    return NextResponse.json({
      totalAttempts: Number.parseInt(statsResult[0].total_attempts) || 0,
      avgScore: Number.parseFloat(statsResult[0].avg_score) || 0,
      weakTopics: weakTopics || [],
    })
  } catch (error) {
    console.error("[v0] Error fetching practice stats:", error)
    console.log(`[Perf] /api/practice/stats failed after ${Date.now() - perfStart}ms`)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
