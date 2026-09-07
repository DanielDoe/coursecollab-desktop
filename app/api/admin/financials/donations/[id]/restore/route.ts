import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export const dynamic = 'force-dynamic'

// POST restore soft-deleted donation
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
        WHERE table_name = 'donations' AND column_name = 'deleted_at'
      `
      hasDeletedAtColumn = columnCheck.length > 0
    } catch (error) {
      return NextResponse.json({ error: "Soft delete not available for donations" }, { status: 500 })
    }

    if (!hasDeletedAtColumn) {
      return NextResponse.json({ error: "Soft delete not available for donations" }, { status: 500 })
    }

    // Check if donation exists and is deleted
    const donationCheck = await sql`
      SELECT id, amount, donor_name, deleted_at FROM donations WHERE id = ${parseInt(id)}
    `

    if (donationCheck.length === 0) {
      return NextResponse.json({ error: "Donation not found" }, { status: 404 })
    }

    const donation = donationCheck[0]

    if (!donation.deleted_at) {
      return NextResponse.json({ error: "Donation is not deleted" }, { status: 400 })
    }

    // Restore the donation by clearing deleted_at
    const result = await sql`
      UPDATE donations
      SET deleted_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
        AND deleted_at IS NOT NULL
      RETURNING id, amount, donor_name, deleted_at
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Failed to restore donation" }, { status: 500 })
    }

    console.log(`[Donation Restore] Restored donation ${id}`)

    return NextResponse.json({ 
      success: true,
      donation: {
        id: result[0].id,
        amount: parseFloat(result[0].amount),
        donorName: result[0].donor_name
      }
    })
  } catch (error) {
    console.error("[Donation Restore] Failed to restore donation:", error)
    return NextResponse.json({ error: "Failed to restore donation" }, { status: 500 })
  }
}

