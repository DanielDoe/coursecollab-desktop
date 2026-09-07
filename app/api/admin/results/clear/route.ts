import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { sectionSqlInClause } from "@/lib/session-code-aliases"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function DELETE(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get('quizId')
    const section = searchParams.get('section')
    const assessmentType = searchParams.get('assessmentType')

    console.log('[Clear Results] Filters:', { quizId, section, assessmentType })

    // Build WHERE conditions array
    const whereConditions: string[] = []
    
    if (quizId && quizId !== 'all') {
      whereConditions.push(`qa.quiz_id = ${Number(quizId)}`)
    }
    
    if (section && section !== 'all') {
      whereConditions.push(sectionSqlInClause("s.section", section))
    }
    
    if (assessmentType && assessmentType !== 'all') {
      // Escape single quotes in assessment type
      const escapedType = assessmentType.replace(/'/g, "''")
      whereConditions.push(`q.assessment_type = '${escapedType}'`)
    }
    
    // Build the WHERE clause
    const whereClause = whereConditions.length > 0 
      ? `AND ${whereConditions.join(' AND ')}` 
      : ''

    // Build query using sql.unsafe for dynamic WHERE clause
    const query = `
      UPDATE quiz_attempts qa
      SET deleted_at = NOW(), deleted_by = NULL
      FROM students s, quizzes q
      WHERE qa.student_id = s.id 
        AND qa.quiz_id = q.id
        AND qa.deleted_at IS NULL
        ${whereClause}
      RETURNING qa.id
    `

    console.log('[Clear Results] Soft deleting with filters')
    console.log('[Clear Results] Query:', query)

    const result = await sql.unsafe(query)

    console.log(`[Clear Results] Soft deleted ${result.length} attempt(s)`)

    return NextResponse.json({
      success: true,
      deletedCount: result.length,
      message: `Successfully deleted ${result.length} quiz attempt(s)`,
      filters: { quizId, section, assessmentType }
    })
  } catch (error) {
    console.error("[v0] Failed to clear quiz results:", error)
    return NextResponse.json({ 
      error: "Failed to clear quiz results",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
