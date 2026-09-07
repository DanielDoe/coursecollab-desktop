import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { getSQL } from "@/lib/db"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { id } = await params
    const { adminId, notes } = await request.json()

    const sql = getSQL()

    // Update request status to approved
    const result = await sql`
      UPDATE password_reset_requests
      SET 
        status = 'approved',
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = ${adminId},
        admin_notes = ${notes || null}
      WHERE id = ${id} AND status = 'pending'
      RETURNING student_id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Request not found or already processed" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to approve password reset:", error)
    return NextResponse.json({ error: "Failed to approve request" }, { status: 500 })
  }
}
