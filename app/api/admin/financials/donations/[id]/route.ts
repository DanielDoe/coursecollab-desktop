import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

    const { id } = await params
    const body = await request.json()
    const { amount, donorName, donorEmail, message, status, isAnonymous } = body

    // Check if deleted_at column exists
    let hasDeletedAtColumn = false
    try {
      const columnCheck = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'donations' AND column_name = 'deleted_at'
      `
      hasDeletedAtColumn = columnCheck.length > 0
    } catch (error) {
      // Ignore - assume column doesn't exist
    }

    // Update donation
    const finalDonorName = isAnonymous ? "Anonymous" : (donorName || sql`donor_name`)
    const finalIsAnonymous = isAnonymous !== undefined ? isAnonymous : sql`is_anonymous`
    
    const result = hasDeletedAtColumn
      ? await sql`
          UPDATE donations
          SET
            amount = ${amount ? parseFloat(amount) : sql`amount`},
            donor_name = ${finalDonorName},
            donor_email = ${donorEmail !== undefined ? donorEmail : sql`donor_email`},
            message = ${message !== undefined ? message : sql`message`},
            is_anonymous = ${finalIsAnonymous},
            status = ${status || sql`status`},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(id)}
            AND deleted_at IS NULL
          RETURNING *
        `
      : await sql`
          UPDATE donations
          SET
            amount = ${amount ? parseFloat(amount) : sql`amount`},
            donor_name = ${finalDonorName},
            donor_email = ${donorEmail !== undefined ? donorEmail : sql`donor_email`},
            message = ${message !== undefined ? message : sql`message`},
            is_anonymous = ${finalIsAnonymous},
            status = ${status || sql`status`},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(id)}
          RETURNING *
        `

    if (result.length === 0) {
      return NextResponse.json({ error: "Donation not found or already deleted" }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true,
      donation: {
        id: result[0].id,
        amount: parseFloat(result[0].amount),
        donorName: result[0].donor_name,
        donorEmail: result[0].donor_email,
        message: result[0].message,
        status: result[0].status,
      }
    })
  } catch (error) {
    console.error("[Admin Financials] Failed to update donation:", error)
    return NextResponse.json(
      { error: "Failed to update donation" },
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
        WHERE table_name = 'donations' AND column_name = 'deleted_at'
      `
      hasDeletedAtColumn = columnCheck.length > 0
    } catch (error) {
      console.error("[Donation Delete] Error checking for deleted_at column:", error)
      // Try to add the column if it doesn't exist
      try {
        await sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL`
        hasDeletedAtColumn = true
        console.log("[Donation Delete] Added deleted_at column to donations table")
      } catch (addColumnError) {
        console.error("[Donation Delete] Could not add deleted_at column:", addColumnError)
      }
    }

    // Always try soft delete first (unless permanent=true is explicitly requested)
    if (permanent) {
      // Permanently delete only if explicitly requested
      await sql`
        DELETE FROM donations
        WHERE id = ${parseInt(id)}
      `
      console.log(`[Donation Delete] Permanently deleted donation ${id}`)
    } else if (hasDeletedAtColumn) {
      // Soft delete (preferred method)
      const result = await sql`
        UPDATE donations
        SET deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id)}
          AND deleted_at IS NULL
        RETURNING id
      `
      if (result.length === 0) {
        return NextResponse.json({ 
          error: "Donation not found or already deleted" 
        }, { status: 404 })
      }
      console.log(`[Donation Delete] Soft deleted donation ${id}`)
    } else {
      // Fallback: if column doesn't exist and permanent not requested, try to add column and soft delete
      try {
        await sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL`
        await sql`
          UPDATE donations
          SET deleted_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${parseInt(id)}
        `
        console.log(`[Donation Delete] Added column and soft deleted donation ${id}`)
      } catch (error) {
        // Last resort: if we can't add column, return error instead of permanent delete
        console.error("[Donation Delete] Failed to add deleted_at column and soft delete:", error)
        return NextResponse.json(
          { 
            error: "Soft delete not available. Please run the migration script: scripts/add-soft-delete-to-financials.sql",
            details: "The deleted_at column does not exist in the donations table"
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ 
      success: true,
      message: permanent ? "Donation permanently deleted" : "Donation deleted"
    })
  } catch (error) {
    console.error("[Admin Financials] Failed to delete donation:", error)
    return NextResponse.json(
      { error: "Failed to delete donation" },
      { status: 500 }
    )
  }
}

