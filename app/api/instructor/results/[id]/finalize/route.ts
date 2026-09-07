/**
 * POST /api/instructor/results/[id]/finalize
 * Mark a student's results report as finalized (reviewed/approved) or clear the flag.
 */
import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  resolveInstructorDisplayName,
  setResultsFinalized,
} from "@/lib/results-finalized"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { requireInstructorAttemptAccess } = await import("@/lib/instructor-results-auth")
    const { id } = await params
    const access = await requireInstructorAttemptAccess(request, id)
    if (!access.ok) return access.response
    const attemptId = String(access.attemptId)
    const adminId = request.headers.get("x-admin-id")
    const body = await request.json().catch(() => ({}))
    const finalized = body.finalized !== false

    const exists = await sql`
      SELECT id FROM quiz_attempts WHERE id = ${attemptId} AND deleted_at IS NULL LIMIT 1
    `
    if (exists.length === 0) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 })
    }

    let finalizedBy: string | null = null
    if (finalized) {
      if (adminId) {
        finalizedBy = "Administrator"
      } else {
        finalizedBy = (await resolveInstructorDisplayName(access.instructorId)) || "Instructor"
      }
    }

    const fields = await setResultsFinalized(attemptId, finalized, finalizedBy)

    return NextResponse.json({
      success: true,
      message: finalized
        ? "Results marked as finalized for the student."
        : "Finalized flag cleared.",
      ...fields,
    })
  } catch (error) {
    console.error("[Results Finalize] Error:", error)
    return NextResponse.json(
      { error: "Failed to update finalized status. Please try again." },
      { status: 500 },
    )
  }
}
