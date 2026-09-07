import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { session_id } = await request.json()

    if (!session_id) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    // Get count before deletion
    const countResult = await sql`
      SELECT COUNT(*) as count FROM students WHERE session_id = ${session_id}
    `
    const studentCount = countResult[0].count

    // Delete all students in the session (cascade will delete quiz attempts)
    await sql`
      DELETE FROM students WHERE session_id = ${session_id}
    `

    return NextResponse.json({
      message: "Students deleted successfully",
      deletedCount: studentCount,
    })
  } catch (error) {
    console.error("[v0] Failed to bulk delete students:", error)
    return NextResponse.json({ error: "Failed to delete students" }, { status: 500 })
  }
}
