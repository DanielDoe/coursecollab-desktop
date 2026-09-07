import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { ensureExpensesSchema } from "@/lib/ensure-expenses-schema"

export const dynamic = 'force-dynamic'

// POST restore soft-deleted expense
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

    const { id } = await params
    const expenseId = parseInt(id)

    if (isNaN(expenseId)) {
      return NextResponse.json({ error: "Invalid expense ID" }, { status: 400 })
    }

    // Ensure expenses table exists
    await ensureExpensesSchema()

    // Check if deleted_at column exists
    let hasDeletedAtColumn = false
    try {
      const columnCheck = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'deleted_at'
      `
      hasDeletedAtColumn = columnCheck.length > 0
    } catch (error) {
      return NextResponse.json({ error: "Soft delete not available for expenses" }, { status: 500 })
    }

    if (!hasDeletedAtColumn) {
      return NextResponse.json({ error: "Soft delete not available for expenses" }, { status: 500 })
    }

    // Check if expense exists and is deleted
    const expenseCheck = await sql`
      SELECT id, description, amount, deleted_at FROM expenses WHERE id = ${expenseId}
    `

    if (expenseCheck.length === 0) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    const expense = expenseCheck[0]

    if (!expense.deleted_at) {
      return NextResponse.json({ error: "Expense is not deleted" }, { status: 400 })
    }

    // Restore the expense by clearing deleted_at
    const result = await sql`
      UPDATE expenses
      SET deleted_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${expenseId}
        AND deleted_at IS NOT NULL
      RETURNING id, description, amount, deleted_at
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Failed to restore expense" }, { status: 500 })
    }

    console.log(`[Expense Restore] Restored expense ${expenseId}`)

    return NextResponse.json({ 
      success: true,
      expense: {
        id: result[0].id,
        description: result[0].description,
        amount: parseFloat(result[0].amount)
      }
    })
  } catch (error) {
    console.error("[Expense Restore] Failed to restore expense:", error)
    return NextResponse.json({ error: "Failed to restore expense" }, { status: 500 })
  }
}

