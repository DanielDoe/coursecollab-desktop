import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get("days") || "7")
    const limit = parseInt(searchParams.get("limit") || "50")

    // Get filter violations
    const violations = await sql`
      SELECT 
        fv.id,
        fv.violation_type,
        fv.created_at,
        s.full_name as student_name,
        s.student_id,
        s.section,
        fv.original_message,
        fv.filtered_response
      FROM ai_tutor_filter_violations fv
      JOIN students s ON fv.student_id = s.id
      WHERE fv.created_at >= NOW() - make_interval(days => ${days})
      ORDER BY fv.created_at DESC
      LIMIT ${limit}
    `

    // Get violation summary
    const summary = await sql`
      SELECT 
        violation_type,
        COUNT(*) as count,
        COUNT(DISTINCT student_id) as unique_students
      FROM ai_tutor_filter_violations
      WHERE created_at >= NOW() - make_interval(days => ${days})
      GROUP BY violation_type
      ORDER BY count DESC
    `

    // Get top violating students (students trying to bypass filters most)
    const topViolators = await sql`
      SELECT 
        s.full_name,
        s.student_id,
        s.section,
        COUNT(*) as violation_count,
        ARRAY_AGG(DISTINCT fv.violation_type) as violation_types
      FROM ai_tutor_filter_violations fv
      JOIN students s ON fv.student_id = s.id
      WHERE fv.created_at >= NOW() - make_interval(days => ${days})
      GROUP BY s.id, s.full_name, s.student_id, s.section
      HAVING COUNT(*) >= 3
      ORDER BY violation_count DESC
      LIMIT 10
    `

    return NextResponse.json({
      success: true,
      violations,
      summary,
      topViolators,
      totalViolations: violations.length,
      timeRange: `Last ${days} days`
    })
  } catch (error: any) {
    console.error("[Filter Violations Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch filter violations",
        violations: [],
        summary: []
      },
      { status: 500 }
    )
  }
}

