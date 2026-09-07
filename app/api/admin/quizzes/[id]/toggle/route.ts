import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { is_active } = await request.json()
    const quizId = params.id

    console.log("[v0] Toggle quiz - Quiz ID:", quizId, "Setting is_active to:", is_active, "Type:", typeof is_active)

    await sql`
      UPDATE quizzes
      SET is_active = ${is_active}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${quizId}
    `

    const result = await sql`
      SELECT id, title, is_active FROM quizzes WHERE id = ${quizId}
    `
    console.log("[v0] After update - Quiz data:", result[0])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to toggle quiz status:", error)
    return NextResponse.json({ error: "Failed to update quiz" }, { status: 500 })
  }
}
