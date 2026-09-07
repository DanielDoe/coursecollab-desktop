import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export const dynamic = 'force-dynamic'

// POST restore soft-deleted membership
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

    const { id } = await params

    // Check if deleted_at column exists
    let hasDeletedAtColumn = false
    try {
      const columnCheck = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'memberships' AND column_name = 'deleted_at'
      `
      hasDeletedAtColumn = columnCheck.length > 0
    } catch (error) {
      return NextResponse.json({ error: "Soft delete not available for memberships" }, { status: 500 })
    }

    if (!hasDeletedAtColumn) {
      return NextResponse.json({ error: "Soft delete not available for memberships" }, { status: 500 })
    }

    // Check if membership exists and is deleted
    const membershipCheck = await sql`
      SELECT id, tier, student_id, deleted_at FROM memberships WHERE id = ${parseInt(id)}
    `

    if (membershipCheck.length === 0) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 })
    }

    const membership = membershipCheck[0]

    if (!membership.deleted_at) {
      return NextResponse.json({ error: "Membership is not deleted" }, { status: 400 })
    }

    // Restore the membership by clearing deleted_at
    const result = await sql`
      UPDATE memberships
      SET deleted_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
        AND deleted_at IS NOT NULL
      RETURNING id, tier, student_id, deleted_at
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Failed to restore membership" }, { status: 500 })
    }

    console.log(`[Membership Restore] Restored membership ${id}`)

    return NextResponse.json({ 
      success: true,
      membership: {
        id: result[0].id,
        tier: result[0].tier || result[0].plan,
        studentId: result[0].student_id
      }
    })
  } catch (error) {
    console.error("[Membership Restore] Failed to restore membership:", error)
    return NextResponse.json({ error: "Failed to restore membership" }, { status: 500 })
  }
}

