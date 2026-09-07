import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import bcrypt from "bcryptjs"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest,
  { params }: { params: Promise<{ id: string }> },) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const { password } = await request.json()
    if (!password || String(password).length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const hash = await bcrypt.hash(String(password), 10)
    const updated = await sql`
      UPDATE students SET password_hash = ${hash}, has_changed_password = true
      WHERE id = ${Number(id)}
        AND (student_program_role IN ('summer_camper', 'summer_student') OR section = 'SUMMER_CAMP')
      RETURNING id
    `

    if (updated.length === 0) {
      return NextResponse.json({ error: "Camper not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/campers/reset-password]", error)
    return NextResponse.json({ error: "Reset failed" }, { status: 500 })
  }
}
