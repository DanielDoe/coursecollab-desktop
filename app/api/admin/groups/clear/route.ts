import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function DELETE(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // Delete all groups (cascade will handle group_members)
    await sql`DELETE FROM groups`

    return NextResponse.json({
      success: true,
      message: "All groups have been deleted",
    })
  } catch (error) {
    console.error("Error clearing groups:", error)
    return NextResponse.json({ error: "Failed to clear groups" }, { status: 500 })
  }
}
