import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // Fetch all soft-deleted quiz attempts (within 24 hours)
    const deletedItems = await sql`
      SELECT 
        qa.id as attempt_id,
        s.full_name as student_name,
        s.student_id,
        s.section,
        q.title as quiz_title,
        q.assessment_type,
        qa.score,
        qa.total_questions,
        ROUND(CASE 
          WHEN qa.total_questions = 0 THEN 0 
          ELSE (qa.score::numeric / qa.total_questions::numeric) * 100 
        END) as percentage,
        qa.deleted_at,
        qa.completed_at
      FROM quiz_attempts qa
      JOIN students s ON qa.student_id = s.id
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.deleted_at IS NOT NULL
        AND qa.deleted_at > NOW() - INTERVAL '24 hours'
      ORDER BY qa.deleted_at DESC
    `

    console.log(`[Trash] Found ${deletedItems.length} deleted items`)

    return NextResponse.json({
      success: true,
      deletedItems
    })
  } catch (error) {
    console.error("[Trash] Failed to fetch:", error)
    return NextResponse.json(
      { error: "Failed to fetch deleted items" },
      { status: 500 }
    )
  }
}

