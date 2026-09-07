import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Question IDs are required" }, { status: 400 })
    }

    await sql`DELETE FROM question_bank WHERE id = ANY(${ids})`

    return NextResponse.json({ success: true, deleted: ids.length })
  } catch (error) {
    console.error("[v0] Error bulk deleting questions:", error)
    return NextResponse.json({ error: "Failed to delete questions" }, { status: 500 })
  }
}
