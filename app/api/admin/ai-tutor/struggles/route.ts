import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {

    // Fetch student struggles with AI analysis
    const struggles = await sql`
      SELECT 
        s.id,
        s.student_id,
        s.full_name as student_name,
        s.student_id as student_id_display,
        s.section,
        atc.topic,
        atc.created_at as last_activity,
        atc.created_at as flagged_at,
        CASE 
          WHEN atc.satisfaction_score <= 2 THEN 'critical'
          WHEN atc.satisfaction_score <= 3 THEN 'high'
          WHEN atc.satisfaction_score <= 4 THEN 'medium'
          ELSE 'low'
        END as severity,
        CASE 
          WHEN atc.message ILIKE '%don''t understand%' OR atc.message ILIKE '%confused%' THEN 'understanding'
          WHEN atc.message ILIKE '%debug%' OR atc.message ILIKE '%error%' THEN 'debugging'
          WHEN atc.message ILIKE '%how to%' OR atc.message ILIKE '%implement%' THEN 'implementation'
          ELSE 'concept'
        END as struggle_type,
        COUNT(atc.id) as questions_asked,
        CASE 
          WHEN COUNT(atc.id) >= 5 AND AVG(atc.satisfaction_score) <= 3 THEN 'new'
          WHEN COUNT(atc.id) >= 3 AND AVG(atc.satisfaction_score) <= 4 THEN 'reviewed'
          ELSE 'resolved'
        END as status,
        SUBSTRING(atc.message, 1, 200) as description
      FROM students s
      JOIN ai_tutor_conversations atc ON s.id = atc.student_id
      WHERE atc.created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY s.id, s.student_id, s.full_name, s.section, atc.topic, atc.created_at, atc.message
      HAVING AVG(atc.satisfaction_score) <= 4 OR COUNT(atc.id) >= 3
      ORDER BY AVG(atc.satisfaction_score) ASC, COUNT(atc.id) DESC
      LIMIT 20
    `

    return NextResponse.json({ 
      struggles: struggles.map(struggle => ({
        id: struggle.id,
        studentName: struggle.student_name,
        studentId: struggle.student_id_display,
        section: struggle.section,
        topic: struggle.topic,
        struggleType: struggle.struggle_type,
        severity: struggle.severity,
        questionsAsked: struggle.questions_asked,
        lastActivity: struggle.last_activity,
        flaggedAt: struggle.flagged_at,
        status: struggle.status,
        description: struggle.description
      }))
    })
  } catch (error) {
    console.error("[v0] Failed to fetch struggles:", error)
    return NextResponse.json({ error: "Failed to fetch struggles" }, { status: 500 })
  }
}

