import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAttemptOwnership } from "@/lib/student-api-auth"

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const attemptId = parseInt(id, 10)

    if (isNaN(attemptId)) {
      return NextResponse.json(
        { error: "Invalid attempt ID" },
        { status: 400 }
      )
    }

    const ownership = await requireAttemptOwnership(request, attemptId)
    if (!ownership.ok) return ownership.response

    const lockRows = await sql`
      SELECT COALESCE(q.lock_student_results_review, false) as lock_student_results_review
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      WHERE qa.id = ${attemptId}
        AND qa.deleted_at IS NULL
      LIMIT 1
    `
    if (lockRows.length === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }
    if (lockRows[0]?.lock_student_results_review === true) {
      return NextResponse.json(
        {
          error:
            "Detailed results and PDF download are unavailable until your instructor releases them.",
        },
        { status: 403 },
      )
    }

    // Update the pdf_downloaded_at timestamp
    const result = await sql`
      UPDATE quiz_attempts
      SET pdf_downloaded_at = NOW()
      WHERE id = ${attemptId}
        AND pdf_downloaded_at IS NULL
      RETURNING id, pdf_downloaded_at
    `

    if (result.length === 0) {
      // Attempt not found or already marked as downloaded
      return NextResponse.json(
        { error: "Attempt not found or PDF already marked as downloaded" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      attemptId: result[0].id,
      pdf_downloaded_at: result[0].pdf_downloaded_at,
    })
  } catch (error: any) {
    console.error("[PDF Download] Failed to mark PDF as downloaded:", error)
    return NextResponse.json(
      { error: "Failed to mark PDF as downloaded" },
      { status: 500 }
    )
  }
}
