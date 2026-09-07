import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    // Platform-wide grading stats — admin dashboard only (was unauthenticated).
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response
    // Get AI vs Instructor agreement rate
    const agreementData = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN override_points IS NULL THEN 1 END) as ai_only,
        COUNT(CASE WHEN override_points IS NOT NULL THEN 1 END) as overridden
      FROM quiz_answers
      WHERE feedback IS NOT NULL
    `

    // Get confidence distribution
    const confidenceData = await sql`
      SELECT 
        CASE 
          WHEN feedback LIKE '%High confidence%' THEN 'High'
          WHEN feedback LIKE '%Medium confidence%' THEN 'Medium'
          WHEN feedback LIKE '%Low confidence%' THEN 'Low'
          ELSE 'Unknown'
        END as confidence_level,
        COUNT(*) as count
      FROM quiz_answers
      WHERE feedback IS NOT NULL
      GROUP BY confidence_level
    `

    // Get grading stats by question type
    const typeStats = await sql`
      SELECT 
        qq.question_type,
        COUNT(*) as total_graded,
        AVG(CASE WHEN qa.is_correct THEN 1.0 ELSE 0.0 END) as avg_score
      FROM quiz_answers qa
      JOIN quiz_questions qq ON qa.question_id = qq.id
      WHERE qa.feedback IS NOT NULL
      GROUP BY qq.question_type
    `

    // Get recent audit logs
    const recentLogs = await sql`
      SELECT * FROM ai_audit_log
      ORDER BY timestamp DESC
      LIMIT 100
    `

    const agreementRow = (agreementData as Array<Record<string, unknown>>)[0]
    const total = Number(agreementRow?.total ?? 0)
    const aiOnly = Number(agreementRow?.ai_only ?? 0)
    const overridden = Number(agreementRow?.overridden ?? 0)
    const agreementRate = total > 0 ? ((aiOnly / total) * 100).toFixed(1) : "0.0"

    return NextResponse.json({
      agreementRate,
      totalGraded: total,
      aiGraded: aiOnly,
      manualReviews: overridden,
      confidenceDistribution: confidenceData,
      typeStats,
      recentLogs,
    })
  } catch (error) {
    console.error("[v0] ❌ Failed to fetch AI analytics:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}
