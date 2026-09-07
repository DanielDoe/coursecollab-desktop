import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function DELETE(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // Delete all projects (cascade will handle project_reports)
    await sql`DELETE FROM projects`

    return NextResponse.json({
      success: true,
      message: "All projects have been deleted",
    })
  } catch (error) {
    console.error("Error clearing projects:", error)
    return NextResponse.json({ error: "Failed to clear projects" }, { status: 500 })
  }
}
