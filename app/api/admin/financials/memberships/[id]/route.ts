import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

    const { id } = await params
    const body = await request.json()
    const { tier, status, expiresAt, autoRenew } = body

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
      // Ignore - assume column doesn't exist
    }

    // Update membership
    const result = hasDeletedAtColumn
      ? await sql`
          UPDATE memberships
          SET
            tier = ${tier || sql`tier`},
            plan = ${tier || sql`plan`},
            status = ${status || sql`status`},
            expires_at = ${expiresAt ? new Date(expiresAt).toISOString() : sql`expires_at`},
            end_date = ${expiresAt ? new Date(expiresAt).toISOString() : sql`end_date`},
            auto_renew = ${autoRenew !== undefined ? autoRenew : sql`auto_renew`},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(id)}
            AND deleted_at IS NULL
          RETURNING *
        `
      : await sql`
          UPDATE memberships
          SET
            tier = ${tier || sql`tier`},
            plan = ${tier || sql`plan`},
            status = ${status || sql`status`},
            expires_at = ${expiresAt ? new Date(expiresAt).toISOString() : sql`expires_at`},
            end_date = ${expiresAt ? new Date(expiresAt).toISOString() : sql`end_date`},
            auto_renew = ${autoRenew !== undefined ? autoRenew : sql`auto_renew`},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(id)}
          RETURNING *
        `

    if (result.length === 0) {
      return NextResponse.json({ error: "Membership not found or already deleted" }, { status: 404 })
    }

    // Also update students table
    if (tier) {
      await sql`
        UPDATE students
        SET membership_tier = ${tier}
        WHERE id = ${result[0].student_id}
      `
    }

    return NextResponse.json({ 
      success: true,
      membership: {
        id: result[0].id,
        tier: result[0].tier || result[0].plan,
        status: result[0].status,
        expiresAt: result[0].expires_at || result[0].end_date,
        autoRenew: result[0].auto_renew,
      }
    })
  } catch (error) {
    console.error("[Admin Financials] Failed to update membership:", error)
    return NextResponse.json(
      { error: "Failed to update membership" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get("permanent") === "true"

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
      console.error("[Membership Delete] Error checking for deleted_at column:", error)
      // Try to add the column if it doesn't exist
      try {
        await sql`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL`
        hasDeletedAtColumn = true
        console.log("[Membership Delete] Added deleted_at column to memberships table")
      } catch (addColumnError) {
        console.error("[Membership Delete] Could not add deleted_at column:", addColumnError)
      }
    }

    // Always try soft delete first (unless permanent=true is explicitly requested)
    if (permanent) {
      // Permanently delete only if explicitly requested
      await sql`
        DELETE FROM memberships
        WHERE id = ${parseInt(id)}
      `
      console.log(`[Membership Delete] Permanently deleted membership ${id}`)
    } else if (hasDeletedAtColumn) {
      // Soft delete (preferred method)
      const result = await sql`
        UPDATE memberships
        SET deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id)}
          AND deleted_at IS NULL
        RETURNING id
      `
      if (result.length === 0) {
        return NextResponse.json({ 
          error: "Membership not found or already deleted" 
        }, { status: 404 })
      }
      console.log(`[Membership Delete] Soft deleted membership ${id}`)
    } else {
      // Fallback: if column doesn't exist and permanent not requested, try to add column and soft delete
      try {
        await sql`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL`
        await sql`
          UPDATE memberships
          SET deleted_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(id)}
        `
        console.log(`[Membership Delete] Added column and soft deleted membership ${id}`)
      } catch (error) {
        // Last resort: if we can't add column, return error instead of permanent delete
        console.error("[Membership Delete] Failed to add deleted_at column and soft delete:", error)
        return NextResponse.json(
          { 
            error: "Soft delete not available. Please run the migration script: scripts/add-soft-delete-to-financials.sql",
            details: "The deleted_at column does not exist in the memberships table"
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ 
      success: true,
      message: permanent ? "Membership permanently deleted" : "Membership deleted"
    })
  } catch (error) {
    console.error("[Admin Financials] Failed to delete membership:", error)
    return NextResponse.json(
      { error: "Failed to delete membership" },
      { status: 500 }
    )
  }
}

