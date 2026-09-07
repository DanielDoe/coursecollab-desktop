import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const section = searchParams.get("section")
    const days = parseInt(searchParams.get("days") || "7")

    const sectionVariants = section ? normalizedSectionVariantsForSql(section) : []
    const sectionFilter =
      section && sectionVariants.length > 0
        ? sql`AND (
            TRIM(s.section) = ANY(${sectionVariants}::text[])
            OR EXISTS (
              SELECT 1 FROM sessions sess
              WHERE sess.id = s.session_id AND TRIM(sess.code) = ANY(${sectionVariants}::text[])
            )
          )`
        : sql``

    // Get total students
    const totalStudents = await sql`
      SELECT COUNT(*) as count
      FROM students s
      WHERE 1=1 ${sectionFilter}
    `

    // Get active AI users
    const activeUsers = await sql`
      SELECT 
        s.id,
        s.full_name,
        s.student_id,
        s.section,
        COUNT(aitc.id) as question_count,
        COUNT(DISTINCT DATE(aitc.created_at)) as active_days,
        MAX(aitc.created_at) as last_active,
        MIN(aitc.created_at) as first_active
      FROM students s
      JOIN ai_tutor_conversations aitc ON s.id = aitc.student_id
      WHERE aitc.created_at >= NOW() - make_interval(days => ${days})
        ${sectionFilter}
      GROUP BY s.id, s.full_name, s.student_id, s.section
      ORDER BY question_count DESC
    `

    // Get inactive students (never used AI or not recently)
    const inactiveStudents = await sql`
      SELECT 
        s.id,
        s.full_name,
        s.student_id,
        s.section,
        COALESCE(MAX(aitc.created_at), NULL) as last_active
      FROM students s
      LEFT JOIN ai_tutor_conversations aitc ON s.id = aitc.student_id
      WHERE 1=1 ${sectionFilter}
      GROUP BY s.id, s.full_name, s.student_id, s.section
      HAVING 
        MAX(aitc.created_at) IS NULL 
        OR MAX(aitc.created_at) < NOW() - make_interval(days => ${days})
      ORDER BY s.full_name
    `

    // Engagement levels
    const engagementLevels = {
      high: activeUsers.filter((u: any) => u.question_count >= 10).length,
      medium: activeUsers.filter((u: any) => u.question_count >= 5 && u.question_count < 10).length,
      low: activeUsers.filter((u: any) => u.question_count > 0 && u.question_count < 5).length,
      none: inactiveStudents.length
    }

    const total = parseInt(totalStudents[0]?.count || 0)
    const engagementRate = total > 0 ? (activeUsers.length / total) * 100 : 0

    return NextResponse.json({
      success: true,
      totalStudents: total,
      activeUsers: activeUsers.length,
      inactiveUsers: inactiveStudents.length,
      engagementRate: Math.round(engagementRate * 10) / 10,
      engagementLevels,
      activeUsersList: activeUsers,
      inactiveUsersList: inactiveStudents,
      timeRange: `Last ${days} days`
    })
  } catch (error) {
    console.error("[Instructor AI Monitoring - Engagement Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch engagement data",
        totalStudents: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        engagementRate: 0,
        engagementLevels: { high: 0, medium: 0, low: 0, none: 0 },
        activeUsersList: [],
        inactiveUsersList: []
      },
      { status: 500 }
    )
  }
}

