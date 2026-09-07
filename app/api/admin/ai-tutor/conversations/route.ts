import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // Fetch recent AI conversations with struggle analysis
    const conversations = await sql`
      SELECT 
        atc.id,
        s.full_name as student_name,
        s.student_id,
        s.section,
        atc.message,
        atc.response,
        atc.topic,
        atc.difficulty_level as difficulty,
        atc.created_at as timestamp,
        atc.satisfaction_score,
        CASE 
          WHEN atc.message ILIKE '%don''t understand%' OR atc.message ILIKE '%confused%' THEN ARRAY['confusion', 'understanding']
          WHEN atc.message ILIKE '%debug%' OR atc.message ILIKE '%error%' THEN ARRAY['debugging', 'technical_issues']
          WHEN atc.message ILIKE '%how to%' OR atc.message ILIKE '%implement%' THEN ARRAY['implementation', 'guidance_needed']
          WHEN atc.message ILIKE '%why%' OR atc.message ILIKE '%explain%' THEN ARRAY['concept_clarity', 'explanation_needed']
          WHEN atc.satisfaction_score <= 2 THEN ARRAY['low_satisfaction', 'needs_help']
          ELSE ARRAY[]::text[]
        END as struggle_indicators
      FROM ai_tutor_conversations atc
      JOIN students s ON atc.student_id = s.id
      ORDER BY atc.created_at DESC
      LIMIT 50
    `

    return NextResponse.json({ 
      conversations: conversations.map(conversation => ({
        id: conversation.id,
        studentName: conversation.student_name,
        studentId: conversation.student_id,
        section: conversation.section,
        message: conversation.message,
        response: conversation.response,
        topic: conversation.topic,
        difficulty: conversation.difficulty,
        timestamp: conversation.timestamp,
        satisfactionScore: conversation.satisfaction_score,
        struggleIndicators: conversation.struggle_indicators
      }))
    })
  } catch (error) {
    console.error("[v0] Failed to fetch conversations:", error)
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 })
  }
}

