import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function DELETE(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { ids } = await request.json()

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid notification IDs" }, { status: 400 })
    }

    await sql`
      DELETE FROM admin_notifications
      WHERE id = ANY(${ids})
    `

    console.log(`[v0] Deleted ${ids.length} admin notifications`)

    return NextResponse.json({ success: true, deleted: ids.length })
  } catch (error) {
    console.error("[v0] Failed to delete notifications:", error)
    return NextResponse.json({ error: "Failed to delete notifications" }, { status: 500 })
  }
}
