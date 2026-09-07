import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const midSemesterId = Number.parseInt(params.id)
    const { is_saved } = await request.json()

    await sql`
      UPDATE mid_semesters
      SET is_saved = ${is_saved}
      WHERE id = ${midSemesterId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to update saved status:", error)
    return NextResponse.json({ error: "Failed to update saved status" }, { status: 500 })
  }
}
