import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/instructor/quizzes/[id]/superpowers-usage
 * Returns attempts with superpowers applied for this quiz (for instructor view)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const quizId = parseInt(id, 10)
    if (!Number.isInteger(quizId) || quizId < 1) {
      return NextResponse.json({ error: "Invalid quiz ID" }, { status: 400 })
    }

    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "50", 10), 100)

    const rows = await sql`
      SELECT
        qa.id as attempt_id,
        qa.attempt_number,
        qa.started_at,
        qa.completed_at,
        qa.superpowers,
        s.student_id,
        s.full_name as student_name
      FROM quiz_attempts qa
      JOIN students s ON s.id = qa.student_id
      WHERE qa.quiz_id = ${quizId}
        AND qa.deleted_at IS NULL
        AND qa.superpowers IS NOT NULL
        AND qa.superpowers != '[]'::jsonb
        AND jsonb_array_length(qa.superpowers) > 0
      ORDER BY qa.started_at DESC
      LIMIT ${limit}
    `

    const usage = rows.map((r: any) => ({
      attemptId: r.attempt_id,
      attemptNumber: r.attempt_number,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      superpowers: Array.isArray(r.superpowers) ? r.superpowers : (typeof r.superpowers === "string" ? JSON.parse(r.superpowers) : []),
      studentId: r.student_id,
      studentName: r.student_name,
    }))

    return NextResponse.json({ usage })
  } catch (error) {
    console.error("[Superpowers Usage] Error:", error)
    return NextResponse.json(
      { error: "Failed to load superpowers usage" },
      { status: 500 }
    )
  }
}
