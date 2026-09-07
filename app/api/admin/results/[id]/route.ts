import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const attemptId = params.id

    console.log("[v0] Deleting quiz attempt:", attemptId)

    // Delete student answers first (foreign key constraint)
    await sql`
      DELETE FROM student_answers
      WHERE attempt_id = ${attemptId}
    `

    // Delete the quiz attempt
    const result = await sql`
      DELETE FROM quiz_attempts
      WHERE id = ${attemptId}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Quiz attempt not found" }, { status: 404 })
    }

    console.log("[v0] Successfully deleted quiz attempt:", attemptId)

    return NextResponse.json({
      success: true,
      message: "Quiz attempt deleted successfully",
    })
  } catch (error) {
    console.error("[v0] Failed to delete quiz attempt:", error)
    return NextResponse.json({ error: "Failed to delete quiz attempt" }, { status: 500 })
  }
}
