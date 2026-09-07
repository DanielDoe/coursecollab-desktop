import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const midSemesterId = Number.parseInt(params.id)
    const body = await request.json()
    const {
      title,
      description,
      isPublic,
      timePerQuestion,
      availableFrom,
      availableUntil,
      retakeEnabled,
      retakeLimit,
      retakePolicy,
      reviewBeforeRetake,
    } = body

    const [updatedMidSemester] = await sql`
      UPDATE mid_semesters
      SET 
        title = ${title},
        description = ${description},
        is_public = ${isPublic},
        time_per_question = ${timePerQuestion},
        available_from = ${availableFrom},
        available_until = ${availableUntil},
        retake_enabled = ${retakeEnabled},
        retake_limit = ${retakeLimit},
        retake_policy = ${retakePolicy},
        review_before_retake = ${reviewBeforeRetake},
        updated_at = NOW()
      WHERE id = ${midSemesterId}
      RETURNING *
    `

    return NextResponse.json(updatedMidSemester)
  } catch (error) {
    console.error("[v0] Failed to update mid-semester:", error)
    return NextResponse.json({ error: "Failed to update mid-semester" }, { status: 500 })
  }
}
