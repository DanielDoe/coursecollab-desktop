import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function DELETE(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const result = await sql`
      DELETE FROM admin_notifications
      RETURNING id
    `

    console.log(`[v0] Cleared all admin notifications (${result.length} deleted)`)

    return NextResponse.json({ success: true, deleted: result.length })
  } catch (error) {
    console.error("[v0] Failed to clear notifications:", error)
    return NextResponse.json({ error: "Failed to clear notifications" }, { status: 500 })
  }
}
