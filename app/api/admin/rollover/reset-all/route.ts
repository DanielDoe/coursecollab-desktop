import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/admin/rollover/reset-all
 * Deletes all student_assessment_rollovers (for testing).
 * Requires admin auth.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId

    const before = await sql`SELECT COUNT(*)::int as n FROM student_assessment_rollovers`
    const count = before[0]?.n ?? 0

    await sql`DELETE FROM student_assessment_rollovers`

    return NextResponse.json({
      success: true,
      message: `Reset complete. Removed ${count} rollover record(s).`,
      removed: count,
    })
  } catch (error) {
    console.error("[Rollover Reset] Error:", error)
    return NextResponse.json(
      { error: "Failed to reset rollovers" },
      { status: 500 }
    )
  }
}
